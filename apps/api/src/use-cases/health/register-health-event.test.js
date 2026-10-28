import "../../env.js";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { eventosSalud } from "../../db/schema.js";
import { ErrorNoEncontrado } from "../../domain/errors.js";
import { limpiarFixtures, crearRastreadorFixtures, crearEventoSaludAislado, crearDuenoYMascotaAislados } from "../../test-support/fixtures.js";
import { registrarEventoSalud } from "./register-health-event.js";
function puertosFalsos() {
    const topicosEncolados = [];
    const ports = {
        cola: {
            enqueue: (topic) => {
                topicosEncolados.push(topic);
            },
            subscribe: () => { },
        },
    };
    return { ports, topicosEncolados };
}
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("registrarEventoSalud", () => {
    it("el dueño registra un evento para su propia mascota, con nivel de confianza inicial 'declarado'", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const { ports } = puertosFalsos();
        const evento = await registrarEventoSalud(ports, idDueno, {
            idMascota,
            tipo: "chequeo",
            fechaEvento: "2025-01-01",
            textoOriginal: "Chequeo anual",
            claveIdempotencia: randomUUID(),
        });
        rastreador.eventIds.push(evento.id);
        expect(evento.nivelConfianza).toBe("declarado");
        expect(evento.creadoPor).toBe(idDueno);
    });
    it("devuelve el mismo evento sin duplicar si se reintenta con la misma claveIdempotencia (RN 6)", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const { ports } = puertosFalsos();
        const claveIdempotencia = randomUUID();
        const input = { idMascota, tipo: "chequeo", fechaEvento: "2025-01-01", textoOriginal: "Chequeo anual", claveIdempotencia: claveIdempotencia };
        const primero = await registrarEventoSalud(ports, idDueno, input);
        rastreador.eventIds.push(primero.id);
        const segundo = await registrarEventoSalud(ports, idDueno, input);
        expect(segundo.id).toBe(primero.id);
        const filas = await db.select().from(eventosSalud).where(eq(eventosSalud.claveIdempotencia, claveIdempotencia));
        expect(filas).toHaveLength(1);
    });
    it("encola la normalización cuando el tipo es vacuna (RN 7), pero no para chequeo o tratamiento", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador, "perro");
        const { ports: portsVacuna, topicosEncolados: topicosVacuna } = puertosFalsos();
        const vacuna = await registrarEventoSalud(portsVacuna, idDueno, {
            idMascota,
            tipo: "vacuna",
            fechaEvento: "2025-01-01",
            textoOriginal: "Antirrábica",
            claveIdempotencia: randomUUID(),
        });
        rastreador.eventIds.push(vacuna.id);
        // Una vacuna se normaliza y, además, cambia la ficha pública.
        expect(topicosVacuna).toEqual(["normalizer", "projector"]);
        expect(vacuna.vacunaCanonicaId).toBeNull();
        const { ports: portsChequeo, topicosEncolados: topicosChequeo } = puertosFalsos();
        const chequeo = await registrarEventoSalud(portsChequeo, idDueno, {
            idMascota,
            tipo: "chequeo",
            fechaEvento: "2025-01-01",
            textoOriginal: "Control general",
            claveIdempotencia: randomUUID(),
        });
        rastreador.eventIds.push(chequeo.id);
        expect(topicosChequeo).toEqual([]);
    });
    it("responde como si no existiera si la mascota no pertenece al dueño que hace la petición (RNF 16)", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const otroDueno = await crearDuenoYMascotaAislados(rastreador);
        const { ports } = puertosFalsos();
        await expect(registrarEventoSalud(ports, otroDueno.idDueno, {
            idMascota,
            tipo: "chequeo",
            fechaEvento: "2025-01-01",
            textoOriginal: "Intento ajeno",
            claveIdempotencia: randomUUID(),
        })).rejects.toThrow(ErrorNoEncontrado);
    });
    it("rechaza con ErrorNoEncontrado si corrigeEventoId apunta a un evento de otra mascota (RN 2)", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const otraMascota = await crearDuenoYMascotaAislados(rastreador);
        const eventoAjeno = await crearEventoSaludAislado(rastreador, { idMascota: otraMascota.idMascota, idDueno: otraMascota.idDueno });
        const { ports } = puertosFalsos();
        await expect(registrarEventoSalud(ports, idDueno, {
            idMascota,
            tipo: "chequeo",
            fechaEvento: "2025-01-01",
            textoOriginal: "Corrección inválida",
            claveIdempotencia: randomUUID(),
            corrigeEventoId: eventoAjeno,
        })).rejects.toThrow(ErrorNoEncontrado);
    });
});
