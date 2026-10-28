import "../env.js";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../db/client.js";
import { duenos } from "../db/schema.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoAislado } from "../test-support/fixtures.js";
import { esViolacionDeUnicidad } from "./db-errors.js";

const rastreador = crearRastreadorFixtures();
afterEach(() => limpiarFixtures(rastreador));

describe("esViolacionDeUnicidad", () => {
    it("regresión: reconoce el error REAL que lanza postgres.js (propiedad `code`), no uno inventado", async () => {
        const dueno = await crearDuenoAislado(rastreador);
        const [{ hmacDocumento }] = await db.select({ hmacDocumento: duenos.hmacDocumento }).from(duenos).where(eq(duenos.id, dueno.id));
        let capturado;
        try {
            await db.insert(duenos).values({
                tipoDocumento: "DNI", numeroDocumentoCifrado: "x", hmacDocumento, nombres: "A", apellidos: "B", correo: `${randomUUID()}@example.com`, fechaConsentimiento: new Date(),
            });
        }
        catch (error) {
            capturado = error;
        }
        expect(capturado).toBeDefined();
        expect(esViolacionDeUnicidad(capturado)).toBe(true);
    });

    it("no confunde otros errores", () => {
        expect(esViolacionDeUnicidad(new Error("x"))).toBe(false);
        expect(esViolacionDeUnicidad({ code: "22P02" })).toBe(false);
        expect(esViolacionDeUnicidad(null)).toBe(false);
    });
});
