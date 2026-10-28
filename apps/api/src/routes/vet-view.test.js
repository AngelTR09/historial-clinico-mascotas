import "../env.js";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { construirPuertosLocales } from "../container.js";
import { db } from "../db/client.js";
import { registroAuditoria, eventosSalud } from "../db/schema.js";
import { limpiarFixtures, crearRastreadorFixtures, crearEventoSaludAislado, crearDuenoYMascotaAislados, crearVeterinarioAislado, } from "../test-support/fixtures.js";

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

describe("GET /pets/:idMascota/vet-view", () => {
    it("ya no existen las rutas de validación: el veterinario registra, no valida (RN 3)", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const idEvento = await crearEventoSaludAislado(rastreador, { idMascota, idDueno });
        const veterinario = await crearVeterinarioAislado(rastreador);
        const { token } = await puertos.autenticacion.issueVetPetAccessToken(veterinario.id, idMascota);
        const headers = { authorization: `Bearer ${token}` };

        const bandeja = await app.inject({ method: "GET", url: `/pets/${idMascota}/pending-validations`, headers });
        const decision = await app.inject({ method: "POST", url: `/pets/${idMascota}/validations`, headers, payload: { idEvento, decision: "valida" } });

        expect(bandeja.statusCode).toBe(404);
        expect(decision.statusCode).toBe(404);
    });

    it("entrega la vista con el acceso de esa mascota y lo audita (RN 9)", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        await crearEventoSaludAislado(rastreador, { idMascota, idDueno });
        const veterinario = await crearVeterinarioAislado(rastreador);
        const { token } = await puertos.autenticacion.issueVetPetAccessToken(veterinario.id, idMascota);

        const respuesta = await app.inject({ method: "GET", url: `/pets/${idMascota}/vet-view`, headers: { authorization: `Bearer ${token}` } });

        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.json().mascota.id).toBe(idMascota);
        expect(respuesta.json().historial).toHaveLength(1);
        expect(respuesta.json()).not.toHaveProperty("pendientes");
        const auditoria = await db.select().from(registroAuditoria).where(eq(registroAuditoria.idMascota, idMascota));
        expect(auditoria).toHaveLength(1);
        expect(auditoria[0]).toMatchObject({ tipoActor: "veterinario", idActor: veterinario.id, accion: "leer_vista_veterinario_mascota" });
    });

    it("prohíbe leer otra mascota con el token de acceso de una distinta (RN 10)", async () => {
        const propia = await crearDuenoYMascotaAislados(rastreador);
        const ajena = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);
        const { token } = await puertos.autenticacion.issueVetPetAccessToken(veterinario.id, propia.idMascota);

        const vistaAjena = await app.inject({ method: "GET", url: `/pets/${ajena.idMascota}/vet-view`, headers: { authorization: `Bearer ${token}` } });

        expect(vistaAjena.statusCode).toBe(403);
        expect(vistaAjena.body).not.toContain(ajena.nombreMascota);
    });

    it("rechaza sin token, y el token del veterinario no sirve en la ruta de eventos del dueño", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);
        const { token } = await puertos.autenticacion.issueVetPetAccessToken(veterinario.id, idMascota);

        const sinToken = await app.inject({ method: "GET", url: `/pets/${idMascota}/vet-view` });
        const crear = await app.inject({
            method: "POST",
            url: "/health-events",
            headers: { authorization: `Bearer ${token}` },
            payload: { idMascota, tipo: "chequeo", fechaEvento: "2026-01-01", textoOriginal: "x", claveIdempotencia: crypto.randomUUID() },
        });

        expect(sinToken.statusCode).toBe(401);
        expect(crear.statusCode).toBeGreaterThanOrEqual(401);
        const eventos = await db.select({ id: eventosSalud.id }).from(eventosSalud).where(eq(eventosSalud.idMascota, idMascota));
        expect(eventos).toHaveLength(0);
    });
});
