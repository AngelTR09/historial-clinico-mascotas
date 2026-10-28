import "../env.js";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../db/client.js";
import { catalogoVacunas } from "../db/schema.js";
import { limpiarFixtures, crearRastreadorFixtures, crearEventoSaludAislado, crearDuenoYMascotaAislados } from "../test-support/fixtures.js";
import { ejecutarBarridoRecordatorios } from "./reminders-worker.js";
function puertosFalsos({ fallaAlEncolarPara } = {}) {
    const encolados = [];
    const ports = {
        cola: {
            enqueue: (topic, payload) => {
                if (payload.to === fallaAlEncolarPara) throw new Error("la cola no responde");
                encolados.push({ topic, payload });
            },
        },
    };
    return { ports, encolados };
}
function fechaHaceNDias(dias) {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString().slice(0, 10);
}
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("ejecutarBarridoRecordatorios", () => {
    it("notifica una vacuna vencida al dueño de la mascota", async () => {
        const { idMascota, idDueno, ownerEmail, nombreMascota } = await crearDuenoYMascotaAislados(rastreador, "perro");
        const [entradaCatalogo] = await db.select().from(catalogoVacunas).where(eq(catalogoVacunas.especie, "perro")).limit(1);
        if (!entradaCatalogo)
            {throw new Error("Se necesita el catálogo canónico sembrado; corre `pnpm db:seed`.");}
        // mesesVigencia meses atrás + 30 días: ya vencida hace un mes, cae dentro de la ventana de recordatorio.
        await crearEventoSaludAislado(rastreador, {
            idMascota,
            idDueno,
            tipo: "vacuna",
            textoOriginal: entradaCatalogo.nombreCanonico,
            fechaEvento: fechaHaceNDias(entradaCatalogo.mesesVigencia * 30 + 30),
            vacunaCanonicaId: entradaCatalogo.id,
        });
        const { ports, encolados } = puertosFalsos();
        const result = await ejecutarBarridoRecordatorios(ports);
        expect(result.encolados).toBeGreaterThanOrEqual(1);
        const encontrado = encolados.find((e) => e.payload.to === ownerEmail);
        expect(encontrado).toBeDefined();
        expect(encontrado.topic).toBe("reminder");
        expect(encontrado.payload.nombreMascota).toBe(nombreMascota);
    });
    it("no notifica una vacuna recién puesta, todavía lejos de vencer", async () => {
        const { idMascota, idDueno, ownerEmail } = await crearDuenoYMascotaAislados(rastreador, "gato");
        const [entradaCatalogo] = await db.select().from(catalogoVacunas).where(eq(catalogoVacunas.especie, "gato")).limit(1);
        if (!entradaCatalogo)
            {throw new Error("Se necesita el catálogo canónico sembrado; corre `pnpm db:seed`.");}
        await crearEventoSaludAislado(rastreador, {
            idMascota,
            idDueno,
            tipo: "vacuna",
            textoOriginal: entradaCatalogo.nombreCanonico,
            fechaEvento: fechaHaceNDias(1),
            vacunaCanonicaId: entradaCatalogo.id,
        });
        const { ports, encolados } = puertosFalsos();
        await ejecutarBarridoRecordatorios(ports);
        expect(encolados.find((e) => e.payload.to === ownerEmail)).toBeUndefined();
    });
    it("si encolar uno falla, el barrido no se corta: los demás se encolan y el fallo se cuenta", async () => {
        const vencida = async (especie) => {
            const dueno = await crearDuenoYMascotaAislados(rastreador, especie);
            const [entrada] = await db.select().from(catalogoVacunas).where(eq(catalogoVacunas.especie, especie)).limit(1);
            if (!entrada)
                {throw new Error("Se necesita el catálogo canónico sembrado; corre `pnpm db:seed`.");}
            await crearEventoSaludAislado(rastreador, {
                idMascota: dueno.idMascota,
                idDueno: dueno.idDueno,
                tipo: "vacuna",
                textoOriginal: entrada.nombreCanonico,
                fechaEvento: fechaHaceNDias(entrada.mesesVigencia * 30 + 30),
                vacunaCanonicaId: entrada.id,
            });
            return dueno.ownerEmail;
        };
        const correoQueFalla = await vencida("perro");
        const correoSano = await vencida("gato");
        const { ports, encolados } = puertosFalsos({ fallaAlEncolarPara: correoQueFalla });
        const resultado = await ejecutarBarridoRecordatorios(ports);
        expect(resultado.fallidosAlEncolar).toBeGreaterThanOrEqual(1);
        expect(encolados.find((e) => e.payload.to === correoSano)).toBeDefined();
        expect(encolados.find((e) => e.payload.to === correoQueFalla)).toBeUndefined();
    });

    it("encola la desparasitación de una mascota cuando se acerca su fecha, con tipo y nombre", async () => {
        const { idMascota, idDueno, ownerEmail } = await crearDuenoYMascotaAislados(rastreador, "perro");
        // Hace 3 meses y 10 días: venció hace poco, dentro de la ventana de aviso.
        await crearEventoSaludAislado(rastreador, { idMascota, idDueno, tipo: "desparasitacion", textoOriginal: "Desparasitación interna", fechaEvento: fechaHaceNDias(100) });
        const { ports, encolados } = puertosFalsos();
        await ejecutarBarridoRecordatorios(ports);
        const encontrado = encolados.find((e) => e.payload.to === ownerEmail);
        expect(encontrado.payload).toMatchObject({ tipo: "desparasitacion", vacuna: "Desparasitación" });
    });

    it("no avisa de una desparasitación reciente ni de una corregida por otra posterior", async () => {
        const reciente = await crearDuenoYMascotaAislados(rastreador, "gato");
        await crearEventoSaludAislado(rastreador, { idMascota: reciente.idMascota, idDueno: reciente.idDueno, tipo: "desparasitacion", fechaEvento: fechaHaceNDias(5) });
        // La desparasitación vieja fue corregida: solo cuenta la corrección, que es reciente (RN 2).
        const corregida = await crearDuenoYMascotaAislados(rastreador, "gato");
        const vieja = await crearEventoSaludAislado(rastreador, { idMascota: corregida.idMascota, idDueno: corregida.idDueno, tipo: "desparasitacion", fechaEvento: fechaHaceNDias(200) });
        await crearEventoSaludAislado(rastreador, { idMascota: corregida.idMascota, idDueno: corregida.idDueno, tipo: "desparasitacion", fechaEvento: fechaHaceNDias(2), corrigeEventoId: vieja });
        const { ports, encolados } = puertosFalsos();
        await ejecutarBarridoRecordatorios(ports);
        expect(encolados.find((e) => e.payload.to === reciente.ownerEmail)).toBeUndefined();
        expect(encolados.find((e) => e.payload.to === corregida.ownerEmail)).toBeUndefined();
    });
});
