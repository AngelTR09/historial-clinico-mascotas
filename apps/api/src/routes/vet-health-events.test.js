import "../env.js";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { construirPuertosLocales } from "../container.js";
import { db } from "../db/client.js";
import { eventosSalud, registroAuditoria, veterinarios } from "../db/schema.js";
import { registrarEventoSaludVeterinario } from "../use-cases/health/register-health-event.js";
import { crearDuenoYMascotaAislados, crearEventoSaludAislado, crearRastreadorFixtures, crearVeterinarioAislado, limpiarFixtures } from "../test-support/fixtures.js";

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

async function acceso(idMascota, veterinario) {
    const { token } = await puertos.autenticacion.issueVetPetAccessToken(veterinario.id, idMascota);
    return { authorization: `Bearer ${token}` };
}

async function registrar(idMascota, headers, cambios = {}) {
    const respuesta = await app.inject({
        method: "POST",
        url: `/pets/${idMascota}/health-events`,
        headers,
        payload: { tipo: "chequeo", fechaEvento: "2026-05-01", textoOriginal: "Control general", claveIdempotencia: randomUUID(), ...cambios },
    });
    if (respuesta.statusCode === 201) rastreador.eventIds.push(respuesta.json().id);
    return respuesta;
}

describe("POST /pets/:idMascota/health-events: el veterinario registra directamente (RN 3)", () => {
    it("crea el evento verificado a nombre del veterinario, sin paso de validación, y lo audita (RN 9)", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);
        await db.update(veterinarios).set({ razonSocial: "Clínica Patitas" }).where(eq(veterinarios.id, veterinario.id));

        const respuesta = await registrar(idMascota, await acceso(idMascota, veterinario));

        expect(respuesta.statusCode).toBe(201);
        const evento = respuesta.json();
        expect(evento).toMatchObject({ idMascota, nivelConfianza: "verificado", creadoPor: null, creadoPorVeterinario: veterinario.id, nombreProfesional: "Clínica Patitas" });
        const auditoria = await db.select().from(registroAuditoria).where(eq(registroAuditoria.idMascota, idMascota));
        expect(auditoria).toHaveLength(1);
        expect(auditoria[0]).toMatchObject({ tipoActor: "veterinario", idActor: veterinario.id, accion: "crear_evento_salud_veterinario" });
    });

    it("acepta una desparasitación, que el PDF pide como tipo de registro (RNF 01)", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);

        const respuesta = await registrar(idMascota, await acceso(idMascota, veterinario), { tipo: "desparasitacion", textoOriginal: "Desparasitación interna" });

        expect(respuesta.statusCode).toBe(201);
        expect(respuesta.json().tipo).toBe("desparasitacion");
    });

    it("reintentar con la misma clave devuelve el mismo evento sin duplicarlo (RN 6)", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);
        const headers = await acceso(idMascota, veterinario);
        const claveIdempotencia = randomUUID();

        const primero = await registrar(idMascota, headers, { claveIdempotencia });
        const segundo = await registrar(idMascota, headers, { claveIdempotencia });

        expect(segundo.json().id).toBe(primero.json().id);
        const filas = await db.select({ id: eventosSalud.id }).from(eventosSalud).where(eq(eventosSalud.idMascota, idMascota));
        expect(filas).toHaveLength(1);
    });

    it("una clave usada en otra mascota es un conflicto y no filtra el evento ajeno", async () => {
        const propia = await crearDuenoYMascotaAislados(rastreador);
        const ajena = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);
        const claveIdempotencia = randomUUID();
        await registrar(ajena.idMascota, await acceso(ajena.idMascota, veterinario), { claveIdempotencia, textoOriginal: "secreto-del-otro-expediente" });

        const respuesta = await registrar(propia.idMascota, await acceso(propia.idMascota, veterinario), { claveIdempotencia });

        expect(respuesta.statusCode).toBe(409);
        expect(respuesta.body).not.toContain("secreto-del-otro-expediente");
    });

    it("una corrección crea un evento nuevo que referencia al anterior; no hay ruta que lo edite (RN 2)", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);
        const original = await crearEventoSaludAislado(rastreador, { idMascota, idDueno });
        const headers = await acceso(idMascota, veterinario);

        const correccion = await registrar(idMascota, headers, { corrigeEventoId: original, textoOriginal: "Corregido" });
        const edicion = await app.inject({ method: "PATCH", url: `/pets/${idMascota}/health-events/${original}`, headers, payload: { textoOriginal: "x" } });

        expect(correccion.statusCode).toBe(201);
        expect(correccion.json().corrigeEventoId).toBe(original);
        expect(edicion.statusCode).toBe(404);
    });

    it("no corrige un evento de otra mascota", async () => {
        const propia = await crearDuenoYMascotaAislados(rastreador);
        const ajena = await crearDuenoYMascotaAislados(rastreador);
        const eventoAjeno = await crearEventoSaludAislado(rastreador, { idMascota: ajena.idMascota, idDueno: ajena.idDueno });
        const veterinario = await crearVeterinarioAislado(rastreador);

        const respuesta = await registrar(propia.idMascota, await acceso(propia.idMascota, veterinario), { corrigeEventoId: eventoAjeno });

        expect(respuesta.statusCode).toBe(404);
    });

    it("el acceso de una mascota no sirve para escribir en otra (RN 10)", async () => {
        const propia = await crearDuenoYMascotaAislados(rastreador);
        const ajena = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);

        const respuesta = await registrar(ajena.idMascota, await acceso(propia.idMascota, veterinario));

        expect(respuesta.statusCode).toBe(403);
        expect(await db.select({ id: eventosSalud.id }).from(eventosSalud).where(eq(eventosSalud.idMascota, ajena.idMascota))).toHaveLength(0);
    });

    it("rechaza sin token y con el token de un dueño", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const sinToken = await registrar(idMascota, {});
        const tokenDueno = await puertos.autenticacion.issueOwnerToken(idDueno);
        const conDueno = await registrar(idMascota, { authorization: `Bearer ${tokenDueno}` });

        expect(sinToken.statusCode).toBe(401);
        expect(conDueno.statusCode).toBeGreaterThanOrEqual(401);
    });

    it("un veterinario revocado no escribe aunque su acceso de 4 h siga vigente (RN 10)", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);
        const headers = await acceso(idMascota, veterinario);
        await db.update(veterinarios).set({ estado: "rechazado" }).where(eq(veterinarios.id, veterinario.id));

        const respuesta = await registrar(idMascota, headers);

        expect(respuesta.statusCode).toBe(403);
        expect(await db.select({ id: eventosSalud.id }).from(eventosSalud).where(eq(eventosSalud.idMascota, idMascota))).toHaveLength(0);
    });

    it("el evento del veterinario aparece en su vista como verificado", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);
        const headers = await acceso(idMascota, veterinario);
        const creado = await registrar(idMascota, headers);

        const vista = await app.inject({ method: "GET", url: `/pets/${idMascota}/vet-view`, headers });

        expect(vista.json().historial.find((e) => e.id === creado.json().id)).toMatchObject({ nivelConfianza: "verificado" });
    });
});

describe("RNF 04: una escritura que falla deja el expediente sin cambios", () => {
    it("un error de la base en mitad del registro no crea ningún evento", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);

        // Un tipo fuera del enum salta la validación zod y hace fallar el INSERT en la base.
        await expect(
            registrarEventoSaludVeterinario(puertos, veterinario.id, idMascota, {
                tipo: "tipo-inexistente",
                fechaEvento: "2026-05-01",
                textoOriginal: "x",
                claveIdempotencia: randomUUID(),
            }),
        ).rejects.toThrow();

        expect(await db.select({ id: eventosSalud.id }).from(eventosSalud).where(eq(eventosSalud.idMascota, idMascota))).toHaveLength(0);
    });
});
