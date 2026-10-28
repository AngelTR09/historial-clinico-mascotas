import "../env.js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { construirPuertosLocales } from "../container.js";

/**
 * Red de seguridad contra "se me olvidó el preHandler": toda ruta registrada
 * debe rechazar una petición sin credenciales (401), salvo las que están
 * declaradas públicas a propósito aquí abajo. Una ruta nueva sin autenticación
 * hace fallar este test hasta que alguien la agregue a la lista y justifique por qué.
 */
const PUBLICAS_A_PROPOSITO = new Map([
    ["GET /health", "sonda de salud del balanceador"],
    ["POST /owners", "alta de cuenta (RF 01): aún no existe sesión"],
    ["POST /vets", "alta de cuenta profesional: nace pendiente de aprobación"],
    ["POST /auth/login", "inicio de sesión (RNF 03 y 06): es donde nace la sesión"],
    ["POST /auth/verify", "activa la cuenta con el código del correo: aún no hay sesión"],
    ["POST /auth/resend-code", "reenvío del código: responde igual exista o no la cuenta"],
    ["GET /public/pets/:tokenQr", "ficha pública por QR (RF 21)"],
    ["POST /public/contact", "formulario de contacto enmascarado (RN 5)"],
    ["PUT /local-storage/*", "subida directa; se autoriza con URL firmada, no con sesión"],
    ["GET /local-storage/*", "descarga directa; se autoriza con URL firmada, no con sesión"],
]);

let app;
beforeAll(async () => {
    app = await buildApp(construirPuertosLocales());
});
afterAll(async () => {
    await app.close();
});

describe("toda ruta exige credenciales salvo las públicas declaradas", () => {
    it("el inventario de rutas no está vacío", () => {
        expect(app.rutasRegistradas.length).toBeGreaterThan(20);
    });

    it("las rutas públicas declaradas siguen existiendo (si no, la lista quedó obsoleta)", () => {
        const registradas = new Set(app.rutasRegistradas.map((r) => `${r.metodo} ${r.url}`));
        for (const clave of PUBLICAS_A_PROPOSITO.keys()) {
            expect(registradas.has(clave), clave).toBe(true);
        }
    });

    it("cualquier otra ruta responde 401 sin Authorization", async () => {
        const sinProteccion = [];
        for (const { metodo, url } of app.rutasRegistradas) {
            if (PUBLICAS_A_PROPOSITO.has(`${metodo} ${url}`)) continue;
            const concreta = url.replace(/:[A-Za-z]+/g, () => randomUUID());
            const respuesta = await app.inject({ method: metodo, url: concreta, payload: metodo === "GET" ? undefined : {} });
            if (respuesta.statusCode !== 401) sinProteccion.push(`${metodo} ${url} → ${respuesta.statusCode}`);
        }
        expect(sinProteccion).toEqual([]);
    });
});
