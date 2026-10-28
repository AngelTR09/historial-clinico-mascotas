import "../../env.js";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoAislado, crearDuenoYMascotaAislados } from "../../test-support/fixtures.js";
import { crearPuertosDePrueba } from "../../test-support/ports.js";
import { registrarEventoSalud } from "../health/register-health-event.js";
import { registrarCamada } from "./register-litter.js";
import { registrarMascota } from "./register-pet.js";
import { actualizarEstadoMascota } from "./update-pet-status.js";
import { actualizarMascota } from "./update-pet.js";
import { mascotas } from "../../db/schema.js";
import { eq } from "drizzle-orm";

const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});

const proyecciones = (encolados) => encolados.filter((e) => e.topic === "projector").map((e) => e.payload.idMascota);

describe("la ficha pública se reproyecta cuando cambia lo que muestra", () => {
    it("al registrar una mascota", async () => {
        const dueno = await crearDuenoAislado(rastreador);
        const { ports, encolados } = crearPuertosDePrueba();
        const mascota = await registrarMascota(ports, dueno.id, { nombre: "Rocky", especie: "perro" });
        rastreador.petIds.push(mascota.id);
        expect(proyecciones(encolados)).toEqual([mascota.id]);
    });

    it("al registrar una camada, una vez por cría y solo tras confirmar la transacción", async () => {
        const dueno = await crearDuenoAislado(rastreador);
        const { ports, encolados } = crearPuertosDePrueba();
        const creadas = await registrarCamada(ports, dueno.id, [{ nombre: "A", especie: "perro" }, { nombre: "B", especie: "perro" }]);
        rastreador.petIds.push(...creadas.map((c) => c.id));
        expect(proyecciones(encolados).sort()).toEqual(creadas.map((c) => c.id).sort());
    });

    it("una camada que falla no proyecta nada", async () => {
        const dueno = await crearDuenoAislado(rastreador);
        const { ports, encolados } = crearPuertosDePrueba();
        await expect(registrarCamada(ports, dueno.id, [{ nombre: "A", especie: "perro" }, { nombre: null, especie: "perro" }])).rejects.toThrow();
        expect(proyecciones(encolados)).toEqual([]);
    });

    it("al editar los datos o el estado de la mascota", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const { ports, encolados } = crearPuertosDePrueba();
        await actualizarMascota(ports, idDueno, idMascota, { colorSenas: "mancha" });
        await actualizarEstadoMascota(ports, idDueno, idMascota, { estado: "extraviada" });
        expect(proyecciones(encolados)).toEqual([idMascota, idMascota]);
    });

    it("al registrar una vacuna, pero no un chequeo (la ficha solo muestra vacunas)", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const { ports, encolados } = crearPuertosDePrueba();
        const base = { idMascota, fechaEvento: "2026-01-01", nombreProfesional: null };
        const chequeo = await registrarEventoSalud(ports, idDueno, { ...base, tipo: "chequeo", textoOriginal: "control", claveIdempotencia: crypto.randomUUID() });
        rastreador.eventIds.push(chequeo.id);
        expect(proyecciones(encolados)).toEqual([]);
        const vacuna = await registrarEventoSalud(ports, idDueno, { ...base, tipo: "vacuna", textoOriginal: "antirrábica", claveIdempotencia: crypto.randomUUID() });
        rastreador.eventIds.push(vacuna.id);
        expect(proyecciones(encolados)).toEqual([idMascota]);
    });

    it("no cambia nada si la mascota es de otro dueño: no proyecta lo que no se modificó", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const otro = await crearDuenoAislado(rastreador);
        const { ports, encolados } = crearPuertosDePrueba();
        await expect(actualizarEstadoMascota(ports, otro.id, idMascota, { estado: "extraviada" })).rejects.toThrow();
        expect(proyecciones(encolados)).toEqual([]);
        const [intacta] = await db.select({ estado: mascotas.estado }).from(mascotas).where(eq(mascotas.id, idMascota));
        expect(intacta.estado).toBe("activa");
    });
});
