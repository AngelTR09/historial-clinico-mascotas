import "../../env.js";
import { vi } from "vitest";

// Fuerza a randomInt a devolver primero la base de un código ya existente (colisión) y luego valores libres.
const secuencia = vi.hoisted(() => ({ valores: [] }));
vi.mock("node:crypto", async (importOriginal) => {
    const original = await importOriginal();
    return { ...original, randomInt: (...args) => (secuencia.valores.length ? secuencia.valores.shift() : original.randomInt(...args)) };
});

import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { mascotas } from "../../db/schema.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoAislado, crearMascotaAislada } from "../../test-support/fixtures.js";
import { registrarMascota } from "./register-pet.js";
import { crearPuertosDePrueba } from "../../test-support/ports.js";
const { ports } = crearPuertosDePrueba();

const rastreador = crearRastreadorFixtures();
afterEach(() => limpiarFixtures(rastreador));

describe("registrarMascota: colisión del public_code", () => {
    it("regresión: reintenta con otro código en vez de fallar con 500 cuando el generado ya existe", async () => {
        const dueno = await crearDuenoAislado(rastreador);
        const existente = await crearMascotaAislada(rastreador, dueno.id);
        // Base de 9 dígitos que, con su dígito verificador, coincide con el código ya ocupado.
        const base = 123456789;
        const { formatearCodigoPublico } = await import("@hcm/shared");
        await db.update(mascotas).set({ codigoPublico: formatearCodigoPublico(String(base)) }).where(eq(mascotas.id, existente.id));

        secuencia.valores.push(base); // 1er intento: colisiona; los siguientes son aleatorios reales
        const nueva = await registrarMascota(ports, dueno.id, { nombre: "Colision", especie: "perro" });
        rastreador.petIds.push(nueva.id);

        expect(nueva.codigoPublico).not.toBe(formatearCodigoPublico(String(base)));
        expect(secuencia.valores).toHaveLength(0);
    });
});
