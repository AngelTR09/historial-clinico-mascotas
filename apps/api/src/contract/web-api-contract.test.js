import "../env.js";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { construirPuertosLocales } from "../container.js";

/**
 * Contrato frontend ↔ API. No hay compilador que detecte que el web llama a
 * una ruta que el backend renombró o borró (JavaScript puro, documentación del proyecto §9),
 * así que este test lee el código fuente del web, extrae cada
 * `api.get|post|patch(<ruta>)` y exige que Fastify tenga esa ruta registrada.
 * Un 401/400/404 de dominio prueba que la ruta existe; solo el 404 genérico de
 * Fastify ("Route X not found") delata una ruta inexistente.
 */
const directorioWeb = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../web/src");
const PATRON_LLAMADA = /api\.(get|post|patch)\(\s*(`[^`]+`|"[^"]+")/g;

function archivosFuente(directorio) {
    return readdirSync(directorio).flatMap((nombre) => {
        const ruta = path.join(directorio, nombre);
        if (statSync(ruta).isDirectory()) return archivosFuente(ruta);
        return /\.(jsx?)$/.test(nombre) && !/\.test\./.test(nombre) ? [ruta] : [];
    });
}

function llamadasDelWeb() {
    const llamadas = new Map();
    for (const archivo of archivosFuente(directorioWeb)) {
        const texto = readFileSync(archivo, "utf8");
        for (const coincidencia of texto.matchAll(PATRON_LLAMADA)) {
            const metodo = coincidencia[1].toUpperCase();
            const url = coincidencia[2].slice(1, -1).replace(/\$\{[^}]+\}/g, () => randomUUID());
            llamadas.set(`${metodo} ${coincidencia[2].slice(1, -1)}`, { metodo, url, archivo: path.relative(directorioWeb, archivo) });
        }
    }
    return [...llamadas.values()];
}

let app;
beforeAll(async () => {
    app = await buildApp(construirPuertosLocales());
});
afterAll(async () => {
    await app.close();
});

describe("contrato web → API", () => {
    const llamadas = llamadasDelWeb();

    it("el escaneo encuentra las llamadas del web (si da 0, el patrón dejó de funcionar)", () => {
        expect(llamadas.length).toBeGreaterThan(15);
    });

    it.each(llamadas.map((l) => [`${l.metodo} ${l.url.replace(/[0-9a-f-]{36}/g, ":id")}`, l]))("%s existe en la API", async (_nombre, llamada) => {
        const respuesta = await app.inject({ method: llamada.metodo, url: llamada.url, payload: llamada.metodo === "GET" ? undefined : {} });
        const esRutaInexistente = respuesta.statusCode === 404 && String(respuesta.json().message ?? "").startsWith("Route ");
        expect(esRutaInexistente, `${llamada.archivo} llama a una ruta que la API no registra`).toBe(false);
    });
});
