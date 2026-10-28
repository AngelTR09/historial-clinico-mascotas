import "../env.js";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { construirPuertosLocales } from "../container.js";
import { db } from "../db/client.js";
import { eventosSalud } from "../db/schema.js";
import { crearDuenoAislado, crearDuenoYMascotaAislados, crearMascotaAislada, crearRastreadorFixtures, limpiarFixtures } from "../test-support/fixtures.js";

const rastreador = crearRastreadorFixtures();
const puertos = construirPuertosLocales();
let app;
beforeAll(async () => {
    app = await buildApp(puertos);
});
afterAll(async () => {
    await app.close();
});
afterEach(async () => {
    await limpiarFixtures(rastreador);
});

async function encabezadoDe(idDueno) {
    return { authorization: `Bearer ${await puertos.autenticacion.issueOwnerToken(idDueno)}` };
}

async function crearEvento(idDueno, carga) {
    const respuesta = await app.inject({ method: "POST", url: "/health-events", headers: await encabezadoDe(idDueno), payload: carga });
    if (respuesta.statusCode === 201) rastreador.eventIds.push(respuesta.json().id);
    return respuesta;
}

function carga(idMascota, extra = {}) {
    return { idMascota, tipo: "chequeo", fechaEvento: "2025-03-01", textoOriginal: "Chequeo anual", claveIdempotencia: randomUUID(), ...extra };
}

describe("POST /health-events", () => {
    it("exige autenticación de dueño", async () => {
        const respuesta = await app.inject({ method: "POST", url: "/health-events", payload: {} });
        expect(respuesta.statusCode).toBe(401);
    });

    it("rechaza datos inválidos con 400 y no escribe nada", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const respuesta = await crearEvento(idDueno, carga(idMascota, { claveIdempotencia: "no-es-uuid" }));
        expect(respuesta.statusCode).toBe(400);
    });

    it("RN 6: reenviar la misma clave devuelve el mismo evento y no lo duplica", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const datos = carga(idMascota);
        const primero = await crearEvento(idDueno, datos);
        const segundo = await crearEvento(idDueno, datos);
        expect(primero.statusCode).toBe(201);
        expect(segundo.json().id).toBe(primero.json().id);
        const filas = await db.select().from(eventosSalud).where(eq(eventosSalud.claveIdempotencia, datos.claveIdempotencia));
        expect(filas).toHaveLength(1);
    });

    it("RN 6: dos envíos simultáneos con la misma clave no producen 500 ni duplicados", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const datos = carga(idMascota);
        const respuestas = await Promise.all(Array.from({ length: 5 }, () => crearEvento(idDueno, datos)));
        expect(respuestas.map((r) => r.statusCode).every((codigo) => codigo === 201)).toBe(true);
        expect(new Set(respuestas.map((r) => r.json().id)).size).toBe(1);
    });

    it("regresión: una clave de idempotencia ya usada en OTRA mascota no devuelve ese evento ajeno", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const otra = await crearMascotaAislada(rastreador, idDueno);
        const datos = carga(idMascota, { textoOriginal: "Dato privado de la primera mascota" });
        await crearEvento(idDueno, datos);
        const respuesta = await crearEvento(idDueno, { ...datos, idMascota: otra.id });
        expect(respuesta.statusCode).toBe(409);
        expect(respuesta.body).not.toContain("Dato privado");
    });

    it("un dueño no puede registrar eventos en la mascota de otro (404, como si no existiera)", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const intruso = await crearDuenoAislado(rastreador);
        const respuesta = await crearEvento(intruso.id, carga(idMascota));
        expect(respuesta.statusCode).toBe(404);
    });

    it("RN 2: corregir crea un evento nuevo que referencia al anterior y deja el original intacto", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const original = (await crearEvento(idDueno, carga(idMascota, { textoOriginal: "Rabia 2024" }))).json();
        const correccion = await crearEvento(idDueno, carga(idMascota, { textoOriginal: "Rabia 2025", corrigeEventoId: original.id }));
        expect(correccion.statusCode).toBe(201);
        expect(correccion.json().corrigeEventoId).toBe(original.id);
        const [fila] = await db.select().from(eventosSalud).where(eq(eventosSalud.id, original.id));
        expect(fila.textoOriginal).toBe("Rabia 2024");
    });

    it("RN 2: no se puede corregir un evento de otra mascota", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const otra = await crearMascotaAislada(rastreador, idDueno);
        const ajeno = (await crearEvento(idDueno, carga(otra.id))).json();
        const respuesta = await crearEvento(idDueno, carga(idMascota, { corrigeEventoId: ajeno.id }));
        expect(respuesta.statusCode).toBe(404);
    });

    it("RN 2: la API no ofrece ninguna ruta para editar o borrar un evento", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const evento = (await crearEvento(idDueno, carga(idMascota))).json();
        for (const metodo of ["PUT", "PATCH", "DELETE"]) {
            const respuesta = await app.inject({ method: metodo, url: `/health-events/${evento.id}`, headers: await encabezadoDe(idDueno), payload: {} });
            expect(respuesta.statusCode, metodo).toBe(404);
        }
    });

    it("RN 7: una vacuna conserva su texto libre y queda sin vacuna canónica hasta que el normalizador la llene", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const respuesta = await crearEvento(idDueno, carga(idMascota, { tipo: "vacuna", textoOriginal: "  sextuple  " }));
        expect(respuesta.json().vacunaCanonicaId).toBeNull();
        expect(respuesta.json().textoOriginal).toContain("sextuple");
    });
});

describe("GET /pets/:idMascota/health-events", () => {
    it("RN 9: lista el historial del dueño y deja rastro de auditoría", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        await crearEvento(idDueno, carga(idMascota));
        const respuesta = await app.inject({ method: "GET", url: `/pets/${idMascota}/health-events`, headers: await encabezadoDe(idDueno) });
        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.json()).toHaveLength(1);
    });

    it("un dueño ajeno no puede leer el historial", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const intruso = await crearDuenoAislado(rastreador);
        const respuesta = await app.inject({ method: "GET", url: `/pets/${idMascota}/health-events`, headers: await encabezadoDe(intruso.id) });
        expect([403, 404]).toContain(respuesta.statusCode);
    });
});
