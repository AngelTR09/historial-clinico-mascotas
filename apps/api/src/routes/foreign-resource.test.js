import "../env.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { construirPuertosLocales } from "../container.js";
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

/**
 * RNF 16: intentar abrir un expediente ajeno no debe exponer nada, ni siquiera que existe. Para cada ruta
 * del dueño, la respuesta a una mascota (o evento) de OTRO dueño debe ser idéntica a la de uno inexistente.
 */
const RUTAS_DE_MASCOTA = [
    ["GET", (id) => `/pets/${id}/health-events`, undefined],
    ["PATCH", (id) => `/pets/${id}`, { colorSenas: "marcas" }],
    ["PATCH", (id) => `/pets/${id}/status`, { estado: "extraviada" }],
    ["POST", (id) => `/pets/${id}/photo/upload-url`, { mime: "image/png" }],
];

describe("RNF 16: un expediente ajeno es indistinguible de uno inexistente", () => {
    it.each(RUTAS_DE_MASCOTA)("%s %#: ajena e inexistente responden lo mismo", async (metodo, ruta, payload) => {
        const propio = await crearDuenoYMascotaAislados(rastreador);
        const ajeno = await crearDuenoYMascotaAislados(rastreador);
        const headers = { authorization: `Bearer ${await puertos.autenticacion.issueOwnerToken(propio.idDueno)}` };

        const deAjeno = await app.inject({ method: metodo, url: ruta(ajeno.idMascota), headers, payload });
        const inexistente = await app.inject({ method: metodo, url: ruta(randomUUID()), headers, payload });

        expect(deAjeno.statusCode).toBe(404);
        expect(inexistente.statusCode).toBe(404);
        expect(deAjeno.body).toBe(inexistente.body);
        expect(deAjeno.body).not.toContain(ajeno.nombreMascota);
    });

    it("crear un evento, una transferencia o una evidencia sobre lo ajeno responde igual que sobre lo inexistente", async () => {
        const propio = await crearDuenoYMascotaAislados(rastreador);
        const ajeno = await crearDuenoYMascotaAislados(rastreador);
        const idEventoAjeno = await crearEventoSaludAislado(rastreador, { idMascota: ajeno.idMascota, idDueno: ajeno.idDueno });
        const headers = { authorization: `Bearer ${await puertos.autenticacion.issueOwnerToken(propio.idDueno)}` };
        const evento = (idMascota) => ({ idMascota, tipo: "chequeo", fechaEvento: "2026-05-01", textoOriginal: "x", claveIdempotencia: randomUUID() });
        const intentos = [
            ["/health-events", (id) => evento(id), ajeno.idMascota],
            ["/transfers", (id) => ({ idMascota: id }), ajeno.idMascota],
            ["/attachments/upload-url", (id) => ({ idEvento: id, mime: "image/png" }), idEventoAjeno],
        ];

        for (const [url, cuerpo, idAjeno] of intentos) {
            const deAjeno = await app.inject({ method: "POST", url, headers, payload: cuerpo(idAjeno) });
            const inexistente = await app.inject({ method: "POST", url, headers, payload: cuerpo(randomUUID()) });
            expect(deAjeno.statusCode, url).toBe(404);
            expect(deAjeno.body, url).toBe(inexistente.body);
        }
    });

    it("cancelar la transferencia de otro responde igual que cancelar una que no existe", async () => {
        const propio = await crearDuenoYMascotaAislados(rastreador);
        const ajeno = await crearDuenoYMascotaAislados(rastreador);
        const headersAjeno = { authorization: `Bearer ${await puertos.autenticacion.issueOwnerToken(ajeno.idDueno)}` };
        const creada = await app.inject({ method: "POST", url: "/transfers", headers: headersAjeno, payload: { idMascota: ajeno.idMascota } });
        const headers = { authorization: `Bearer ${await puertos.autenticacion.issueOwnerToken(propio.idDueno)}` };

        const deAjeno = await app.inject({ method: "POST", url: `/transfers/${creada.json().transferencia.id}/cancel`, headers });
        const inexistente = await app.inject({ method: "POST", url: `/transfers/${randomUUID()}/cancel`, headers });

        expect(deAjeno.statusCode).toBe(404);
        expect(deAjeno.body).toBe(inexistente.body);
    });

    it("el acceso del veterinario a otra mascota responde igual exista o no esa mascota", async () => {
        const propia = await crearDuenoYMascotaAislados(rastreador);
        const ajena = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);
        const { token } = await puertos.autenticacion.issueVetPetAccessToken(veterinario.id, propia.idMascota);
        const headers = { authorization: `Bearer ${token}` };

        const deAjena = await app.inject({ method: "GET", url: `/pets/${ajena.idMascota}/vet-view`, headers });
        const inexistente = await app.inject({ method: "GET", url: `/pets/${randomUUID()}/vet-view`, headers });

        expect(deAjena.statusCode).toBe(403);
        expect(deAjena.body).toBe(inexistente.body);
    });
});
