import "../env.js";
import { rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { construirPuertosLocales } from "../container.js";
import { db } from "../db/client.js";
import { registroAuditoria } from "../db/schema.js";
import { crearDuenoAislado, crearDuenoYMascotaAislados, crearRastreadorFixtures, limpiarFixtures } from "../test-support/fixtures.js";

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

describe("PATCH /pets/:idMascota", () => {
    it("actualiza los datos del dueño, audita la acción (RN 9) y los refleja en la ficha pública", async () => {
        const { idDueno, idMascota, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const respuesta = await app.inject({
            method: "PATCH",
            url: `/pets/${idMascota}`,
            headers: await encabezadoDe(idDueno),
            payload: { colorSenas: "collar rojo", alertasMedicas: "sorda", alertasMedicasPublicas: true },
        });
        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.json()).toMatchObject({ colorSenas: "collar rojo", alertasMedicas: "sorda", alertasMedicasPublicas: true });
        const auditoria = await db.select().from(registroAuditoria).where(eq(registroAuditoria.idMascota, idMascota));
        expect(auditoria.map((fila) => fila.accion)).toEqual(["actualizar_mascota"]);
        expect(auditoria[0]).toMatchObject({ tipoActor: "dueno", idActor: idDueno });
        const publica = await app.inject({ method: "GET", url: `/public/pets/${tokenQr}` });
        expect(publica.json()).toMatchObject({ colorSenas: "collar rojo", alertasMedicas: "sorda" });
    });
    it("rechaza con 400 una nota con un correo o un teléfono", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const headers = await encabezadoDe(idDueno);
        const conCorreo = await app.inject({ method: "PATCH", url: `/pets/${idMascota}`, headers, payload: { notaDelDueno: "mi correo es a@b.com" } });
        const conTelefono = await app.inject({ method: "PATCH", url: `/pets/${idMascota}`, headers, payload: { notaDelDueno: "llama al 987654321" } });
        expect(conCorreo.statusCode).toBe(400);
        expect(conTelefono.statusCode).toBe(400);
    });
    it("responde 404 si la mascota es de otro dueño y 401 sin token", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const otro = await crearDuenoAislado(rastreador);
        const ajeno = await app.inject({ method: "PATCH", url: `/pets/${idMascota}`, headers: await encabezadoDe(otro.id), payload: { colorSenas: "x" } });
        const anonimo = await app.inject({ method: "PATCH", url: `/pets/${idMascota}`, payload: { colorSenas: "x" } });
        expect(ajeno.statusCode).toBe(404);
        expect(anonimo.statusCode).toBe(401);
    });
});

function rutaDe(url) {
    const { pathname, search } = new URL(url);
    return `${pathname}${search}`;
}

describe("foto de la mascota", () => {
    afterAll(async () => {
        await rm(path.resolve(config.STORAGE_LOCAL_PATH, "pets"), { recursive: true, force: true });
    });

    it("sube la foto con URL firmada, la fija en la mascota y aparece en la ficha del QR", async () => {
        const { idDueno, idMascota, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const headers = await encabezadoDe(idDueno);
        const solicitud = await app.inject({ method: "POST", url: `/pets/${idMascota}/photo/upload-url`, headers, payload: { mime: "image/jpeg" } });
        expect(solicitud.statusCode).toBe(200);
        const { clave, url } = solicitud.json();
        expect(clave).toMatch(new RegExp(`^pets/${idMascota}/[0-9a-f-]{36}\\.jpg$`));
        const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
        const subida = await app.inject({ method: "PUT", url: rutaDe(url), headers: { "content-type": "image/jpeg" }, payload: bytes });
        expect(subida.statusCode).toBe(204);

        const confirmacion = await app.inject({ method: "PUT", url: `/pets/${idMascota}/photo`, headers, payload: { clave } });
        expect(confirmacion.statusCode).toBe(200);
        expect(confirmacion.json()).toMatchObject({ claveFoto: clave });
        expect(confirmacion.json().urlFoto).toContain("/local-storage/");

        const listado = await app.inject({ method: "GET", url: "/pets", headers });
        expect(listado.json().find((m) => m.id === idMascota).urlFoto).toBeTruthy();

        const publica = await app.inject({ method: "GET", url: `/public/pets/${tokenQr}` });
        const urlPublica = publica.json().urlFoto;
        expect(urlPublica).toBeTruthy();
        const imagen = await app.inject({ method: "GET", url: rutaDe(urlPublica) });
        expect(imagen.statusCode).toBe(200);
        expect(imagen.headers["content-type"]).toContain("image/jpeg");
        expect(Buffer.compare(imagen.rawPayload, bytes)).toBe(0);
    });

    it("rechaza tipos que no son imagen y claves de otra mascota", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const headers = await encabezadoDe(idDueno);
        const noImagen = await app.inject({ method: "POST", url: `/pets/${idMascota}/photo/upload-url`, headers, payload: { mime: "application/pdf" } });
        expect(noImagen.statusCode).toBe(400);
        const ajena = await app.inject({ method: "PUT", url: `/pets/${idMascota}/photo`, headers, payload: { clave: `pets/${randomUUID()}/${randomUUID()}.jpg` } });
        expect(ajena.statusCode).toBe(400);
    });

    it("responde 404 a otro dueño y 401 sin token", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const otro = await crearDuenoAislado(rastreador);
        const ajeno = await app.inject({ method: "POST", url: `/pets/${idMascota}/photo/upload-url`, headers: await encabezadoDe(otro.id), payload: { mime: "image/png" } });
        const anonimo = await app.inject({ method: "PUT", url: `/pets/${idMascota}/photo`, payload: { clave: "x" } });
        expect(ajeno.statusCode).toBe(404);
        expect(anonimo.statusCode).toBe(401);
    });
});
