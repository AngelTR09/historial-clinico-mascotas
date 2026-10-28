import "../env.js";
import { rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { construirPuertosLocales } from "../container.js";
import { config } from "../config.js";
const puertos = construirPuertosLocales();
const clave = `pruebas-firma/${randomUUID()}.txt`;
let app;
function rutaDe(url) {
    const { pathname, search } = new URL(url);
    return `${pathname}${search}`;
}
beforeAll(async () => {
    app = await buildApp(puertos);
});
afterAll(async () => {
    await app.close();
    await rm(path.resolve(config.STORAGE_LOCAL_PATH, "pruebas-firma"), { recursive: true, force: true });
});
describe("/local-storage", () => {
    it("sin firma no deja ni escribir ni leer", async () => {
        const ruta = `/local-storage/${encodeURIComponent(clave)}`;
        expect((await app.inject({ method: "PUT", url: ruta, headers: { "content-type": "text/plain" }, payload: "hola" })).statusCode).toBe(403);
        expect((await app.inject({ method: "GET", url: ruta })).statusCode).toBe(403);
    });
    it("con URLs firmadas del puerto sube y lee el archivo", async () => {
        const { url: urlSubida } = await puertos.almacenamiento.getUploadUrl(clave, "text/plain");
        const subida = await app.inject({ method: "PUT", url: rutaDe(urlSubida), headers: { "content-type": "text/plain" }, payload: "hola" });
        expect(subida.statusCode).toBe(204);
        const { url: urlLectura } = await puertos.almacenamiento.getDownloadUrl(clave);
        const lectura = await app.inject({ method: "GET", url: rutaDe(urlLectura) });
        expect(lectura.statusCode).toBe(200);
        expect(lectura.body).toBe("hola");
    });
    it("una URL de lectura no sirve para escribir", async () => {
        const { url } = await puertos.almacenamiento.getDownloadUrl(clave);
        const respuesta = await app.inject({ method: "PUT", url: rutaDe(url), headers: { "content-type": "text/plain" }, payload: "x" });
        expect(respuesta.statusCode).toBe(403);
    });
    it("una URL firmada para otra clave no abre esta", async () => {
        const { url } = await puertos.almacenamiento.getDownloadUrl("pruebas-firma/otra.txt");
        const { search } = new URL(url);
        const respuesta = await app.inject({ method: "GET", url: `/local-storage/${encodeURIComponent(clave)}${search}` });
        expect(respuesta.statusCode).toBe(403);
    });
});
