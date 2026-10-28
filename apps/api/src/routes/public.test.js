import "../env.js";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { construirPuertosLocales } from "../container.js";
import { db } from "../db/client.js";
import { mascotas, registroAuditoria } from "../db/schema.js";
import { crearDuenoYMascotaAislados, crearRastreadorFixtures, limpiarFixtures } from "../test-support/fixtures.js";

const rastreador = crearRastreadorFixtures();
let app;
beforeAll(async () => {
    app = await buildApp(construirPuertosLocales());
});
afterAll(async () => {
    await app.close();
});
afterEach(async () => {
    await limpiarFixtures(rastreador);
});

describe("GET /public/pets/:tokenQr (canal público)", () => {
    it("responde sin autenticación y audita la lectura (RN 9)", async () => {
        const { idMascota, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const respuesta = await app.inject({ method: "GET", url: `/public/pets/${tokenQr}` });
        expect(respuesta.statusCode).toBe(200);
        const auditoria = await db.select().from(registroAuditoria).where(eq(registroAuditoria.idMascota, idMascota));
        expect(auditoria.map((fila) => fila.accion)).toContain("leer_ficha_publica");
    });

    it("RN 1 y RN 5: la respuesta no contiene código de identificación, id de dueño ni correo", async () => {
        const { idDueno, idMascota, ownerEmail, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const [fila] = await db.select({ codigoPublico: mascotas.codigoPublico }).from(mascotas).where(eq(mascotas.id, idMascota));
        const cuerpo = (await app.inject({ method: "GET", url: `/public/pets/${tokenQr}` })).body;
        for (const secreto of [fila.codigoPublico, idDueno, idMascota, ownerEmail]) {
            expect(cuerpo).not.toContain(secreto);
        }
        expect(cuerpo).not.toMatch(/"(idDueno|codigoPublico|correo|email|telefono|phone|numeroDocumento)"/);
    });

    it("RN 5: las alertas médicas solo salen si el dueño las marcó como públicas", async () => {
        const privada = await crearDuenoYMascotaAislados(rastreador, "perro", { alertasMedicas: "SECRETO-privado", alertasMedicasPublicas: false });
        const publica = await crearDuenoYMascotaAislados(rastreador, "perro", { alertasMedicas: "AVISO-publico", alertasMedicasPublicas: true });
        expect((await app.inject({ method: "GET", url: `/public/pets/${privada.tokenQr}` })).body).not.toContain("SECRETO-privado");
        expect((await app.inject({ method: "GET", url: `/public/pets/${publica.tokenQr}` })).body).toContain("AVISO-publico");
    });

    it("un token inexistente da 404 y no revela nada", async () => {
        const respuesta = await app.inject({ method: "GET", url: "/public/pets/token-que-no-existe" });
        expect(respuesta.statusCode).toBe(404);
    });
});
