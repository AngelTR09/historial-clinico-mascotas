import "../env.js";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { config } from "../config.js";
import { construirPuertosLocales } from "../container.js";
import { crearRastreadorFixtures, limpiarFixtures } from "../test-support/fixtures.js";

const CONTRASENA = "Clave-Segura-2026!";
const rastreador = crearRastreadorFixtures();
const enviados = [];
const base = construirPuertosLocales();
const puertos = { ...base, notificacion: { notify: async (n) => void enviados.push(n) } };
let app;

beforeAll(async () => {
    app = await buildApp(puertos);
});
afterAll(async () => {
    await app.close();
});
afterEach(async () => {
    enviados.length = 0;
    await limpiarFixtures(rastreador);
});

const alta = (cambios = {}) => ({
    tipoDocumento: "DNI",
    numeroDocumento: String(Math.floor(10000000 + Math.random() * 89999999)),
    nombres: "Ana",
    apellidos: "Torres",
    correo: `ana-${randomUUID()}@example.com`,
    contrasena: CONTRASENA,
    aceptaTratamientoDatos: true,
    ...cambios,
});
const post = (url, payload, headers) => app.inject({ method: "POST", url, payload, headers });
const codigoEnviado = () => enviados.filter((n) => n.template === "codigo_verificacion").at(-1)?.data.codigo;

async function registrarYVerificar() {
    const datos = alta();
    const registro = await post("/owners", datos);
    rastreador.ownerIds.push(registro.json().idDueno);
    const verificado = await post("/auth/verify", { rol: "dueno", correo: datos.correo, codigo: codigoEnviado() });
    return { datos, token: verificado.json().token, idDueno: registro.json().idDueno };
}

describe("registro, verificación e inicio de sesión de punta a punta", () => {
    it("el alta no da sesión; el código del correo la da; el token abre GET /owners/me (RNF 03)", async () => {
        const datos = alta();
        const registro = await post("/owners", datos);
        rastreador.ownerIds.push(registro.json().idDueno);

        expect(registro.statusCode).toBe(201);
        expect(registro.json()).toEqual({ idDueno: expect.any(String), requiereVerificacion: true });
        expect(registro.body).not.toContain(CONTRASENA);

        const verificado = await post("/auth/verify", { rol: "dueno", correo: datos.correo, codigo: codigoEnviado() });
        expect(verificado.statusCode).toBe(200);
        const perfil = await app.inject({ method: "GET", url: "/owners/me", headers: { authorization: `Bearer ${verificado.json().token}` } });
        expect(perfil.statusCode).toBe(200);
        expect(perfil.json().email).toBe(datos.correo);
    });

    it("rechaza una contraseña que no cumple la política de Cognito", async () => {
        const respuesta = await post("/owners", alta({ contrasena: "corta" }));
        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.body).not.toContain("corta\"");
    });

    it("POST /auth/login devuelve sesión con las credenciales correctas", async () => {
        const { datos, idDueno } = await registrarYVerificar();
        const respuesta = await post("/auth/login", { rol: "dueno", correo: datos.correo, contrasena: CONTRASENA });
        expect(respuesta.statusCode).toBe(200);
        const perfil = await app.inject({ method: "GET", url: "/owners/me", headers: { authorization: `Bearer ${respuesta.json().token}` } });
        expect(perfil.json().id).toBe(idDueno);
    });

    it("credenciales malas: 401 con el mismo cuerpo para correo inexistente y contraseña errónea", async () => {
        const { datos } = await registrarYVerificar();
        const inexistente = await post("/auth/login", { rol: "dueno", correo: `nadie-${randomUUID()}@example.com`, contrasena: CONTRASENA });
        const erronea = await post("/auth/login", { rol: "dueno", correo: datos.correo, contrasena: "Otra-Clave-2026!" });
        expect(inexistente.statusCode).toBe(401);
        expect(erronea.statusCode).toBe(401);
        expect(erronea.body).toBe(inexistente.body);
    });

    it("sin verificar el correo no hay sesión: 403", async () => {
        const datos = alta();
        const registro = await post("/owners", datos);
        rastreador.ownerIds.push(registro.json().idDueno);
        const respuesta = await post("/auth/login", { rol: "dueno", correo: datos.correo, contrasena: CONTRASENA });
        expect(respuesta.statusCode).toBe(403);
        expect(respuesta.json()).not.toHaveProperty("token");
    });

    it("un código mal escrito es 400 y uno equivocado es 401 sin pistas", async () => {
        const { datos } = await registrarYVerificar();
        const malFormado = await post("/auth/verify", { rol: "dueno", correo: datos.correo, codigo: "12" });
        const equivocado = await post("/auth/verify", { rol: "dueno", correo: datos.correo, codigo: "123456" });
        expect(malFormado.statusCode).toBe(400);
        expect(equivocado.statusCode).toBe(401);
    });

    it("POST /auth/resend-code responde 202 igual para un correo que existe y para uno que no", async () => {
        const datos = alta();
        const registro = await post("/owners", datos);
        rastreador.ownerIds.push(registro.json().idDueno);
        const existente = await post("/auth/resend-code", { rol: "dueno", correo: datos.correo });
        const inexistente = await post("/auth/resend-code", { rol: "dueno", correo: `nadie-${randomUUID()}@example.com` });
        expect(existente.statusCode).toBe(202);
        expect(inexistente.statusCode).toBe(202);
        expect(existente.body).toBe(inexistente.body);
    });
});

describe("sesiones inválidas no acceden a nada (RNF 06)", () => {
    it("sin token, con un token manipulado o vencido: 401 y ningún dato", async () => {
        const { token, idDueno } = await registrarYVerificar();
        const vencido = await new SignJWT({ sub: idDueno, role: "owner" })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
            .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
            .sign(new TextEncoder().encode(config.JWT_SECRET));
        const manipulado = `${token.slice(0, -4)}AAAA`;

        for (const autorizacion of [undefined, `Bearer ${vencido}`, `Bearer ${manipulado}`, "Bearer basura"]) {
            const respuesta = await app.inject({ method: "GET", url: "/owners/me", headers: autorizacion ? { authorization: autorizacion } : {} });
            expect(respuesta.statusCode, String(autorizacion)).toBe(401);
            expect(respuesta.body).not.toContain(idDueno);
        }
    });

    it("el token de un veterinario no abre rutas de dueño", async () => {
        const { token } = await registrarYVerificar();
        const comoVeterinario = await app.inject({ method: "GET", url: "/vets/me", headers: { authorization: `Bearer ${token}` } });
        expect(comoVeterinario.statusCode).toBeGreaterThanOrEqual(401);
    });
});
