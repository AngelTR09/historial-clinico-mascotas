import "../env.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { construirPuertosLocales } from "../container.js";

let instante = 1_000_000;
let app;

beforeAll(async () => {
    app = await buildApp(construirPuertosLocales(), { limiteAutenticacionPorMinuto: 3, ahora: () => instante });
});
afterAll(async () => {
    await app.close();
});

const llamar = (metodo, url, ip = "10.0.0.1") => app.inject({ method: metodo, url, remoteAddress: ip, payload: metodo === "POST" ? {} : undefined });

describe("límite de solicitudes de /auth/* y del alta de cuentas", () => {
    it("deja pasar hasta el tope y luego responde 429 con Retry-After (cuenta aunque el cuerpo sea inválido)", async () => {
        instante += 120_000;
        for (let i = 0; i < 3; i++) {
            expect((await llamar("POST", "/auth/login")).statusCode).toBe(400);
        }
        const excedida = await llamar("POST", "/auth/login");
        expect(excedida.statusCode).toBe(429);
        expect(Number(excedida.headers["retry-after"])).toBeGreaterThan(0);
        expect(Number(excedida.headers["retry-after"])).toBeLessThanOrEqual(60);
        expect(excedida.json().error).toMatch(/Demasiadas solicitudes/);
    });

    it("la ventana se reinicia a los 60 segundos", async () => {
        instante += 120_000;
        for (let i = 0; i < 4; i++) await llamar("POST", "/auth/login", "10.0.0.2");
        expect((await llamar("POST", "/auth/login", "10.0.0.2")).statusCode).toBe(429);

        instante += 61_000;

        expect((await llamar("POST", "/auth/login", "10.0.0.2")).statusCode).toBe(400);
    });

    it("cada IP tiene su propio presupuesto", async () => {
        instante += 120_000;
        for (let i = 0; i < 5; i++) await llamar("POST", "/auth/verify", "10.0.0.3");
        expect((await llamar("POST", "/auth/verify", "10.0.0.3")).statusCode).toBe(429);
        expect((await llamar("POST", "/auth/verify", "10.0.0.4")).statusCode).toBe(400);
    });

    it("el inicio de sesión y el alta de cuentas no se descuentan el presupuesto entre sí", async () => {
        instante += 120_000;
        for (let i = 0; i < 5; i++) await llamar("POST", "/auth/login", "10.0.0.5");
        expect((await llamar("POST", "/auth/login", "10.0.0.5")).statusCode).toBe(429);
        expect((await llamar("POST", "/owners", "10.0.0.5")).statusCode).toBe(400);
        for (let i = 0; i < 3; i++) await llamar("POST", "/vets", "10.0.0.5");
        expect((await llamar("POST", "/vets", "10.0.0.5")).statusCode).toBe(429);
    });

    it("no limita el resto de la API: sonda de salud y ficha pública", async () => {
        instante += 120_000;
        for (let i = 0; i < 10; i++) {
            expect((await llamar("GET", "/health", "10.0.0.6")).statusCode).toBe(200);
        }
        expect((await llamar("GET", "/public/pets/inexistente", "10.0.0.6")).statusCode).toBe(404);
    });
});
