import "../../env.js";
import { esquemaCreacionCamada } from "@hcm/shared";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { mascotas } from "../../db/schema.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoAislado } from "../../test-support/fixtures.js";
import { registrarCamada } from "./register-litter.js";
import { crearPuertosDePrueba } from "../../test-support/ports.js";
const { ports } = crearPuertosDePrueba();
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("registrarCamada", () => {
    it("crea las 8 mascotas del lote en una sola llamada, cada una con código y QR distintos", async () => {
        const owner = await crearDuenoAislado(rastreador);
        const inputs = Array.from({ length: 8 }, (_, i) => ({ nombre: `Cria${i}`, especie: "perro" }));
        const creadas = await registrarCamada(ports, owner.id, inputs);
        rastreador.petIds.push(...creadas.map((p) => p.id));
        expect(creadas).toHaveLength(8);
        expect(creadas.every((p) => p.idDueno === owner.id)).toBe(true);
        expect(new Set(creadas.map((p) => p.codigoPublico)).size).toBe(8);
        expect(new Set(creadas.map((p) => p.tokenQr)).size).toBe(8);
        const filas = await db.select().from(mascotas).where(eq(mascotas.idDueno, owner.id));
        expect(filas).toHaveLength(8);
    });
    it("el esquema rechaza un lote de 9 mascotas (RNF: hasta 8)", () => {
        const inputs = Array.from({ length: 9 }, (_, i) => ({ nombre: `Cria${i}`, especie: "perro" }));
        const result = esquemaCreacionCamada.safeParse({ mascotas: inputs });
        expect(result.success).toBe(false);
    });
    it("el esquema acepta exactamente 8", () => {
        const inputs = Array.from({ length: 8 }, (_, i) => ({ nombre: `Cria${i}`, especie: "perro" }));
        const result = esquemaCreacionCamada.safeParse({ mascotas: inputs });
        expect(result.success).toBe(true);
    });
});
