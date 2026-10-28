import "../env.js";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { AdaptadorColaEnMemoria } from "../adapters/local/in-memory-queue-adapter.js";
import { db } from "../db/client.js";
import { mascotas } from "../db/schema.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoAislado } from "../test-support/fixtures.js";
import { registrarTrabajadorCargaMasivaMascotas } from "./bulk-pet-upload-worker.js";
function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function puertosFalsos() {
    const notificados = [];
    const cola = new AdaptadorColaEnMemoria();
    const ports = {
        cola,
        notificacion: {
            notify: async (input) => {
                notificados.push(input);
            },
        },
    };
    return { ports, notificados };
}
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("registrarTrabajadorCargaMasivaMascotas", () => {
    it("crea cada mascota del lote y notifica al dueño con el resultado", async () => {
        const owner = await crearDuenoAislado(rastreador);
        const { ports, notificados } = puertosFalsos();
        registrarTrabajadorCargaMasivaMascotas(ports);
        const inputs = Array.from({ length: 5 }, (_, i) => ({ nombre: `Albergue${i}`, especie: "perro" }));
        ports.cola.enqueue("bulk-pet-upload", { idDueno: owner.id, mascotas: inputs });
        await esperar(300);
        const filas = await db.select().from(mascotas).where(eq(mascotas.idDueno, owner.id));
        rastreador.petIds.push(...filas.map((r) => r.id));
        expect(filas).toHaveLength(5);
        expect(notificados).toHaveLength(1);
        expect(notificados[0]?.to).toBe(owner.email);
        expect(notificados[0]?.data).toMatchObject({ total: 5, exitosas: 5, fallidas: 0 });
    });
});
