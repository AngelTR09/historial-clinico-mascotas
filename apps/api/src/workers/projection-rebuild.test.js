import "../env.js";
import { afterEach, describe, expect, it } from "vitest";
import { AdaptadorColaEnMemoria } from "../adapters/local/in-memory-queue-adapter.js";
import { AdaptadorProyeccionEnMemoria } from "../adapters/local/in-memory-projection-adapter.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoAislado, crearMascotaAislada } from "../test-support/fixtures.js";
import { reconstruirProyecciones, reconstruirProyeccionesDentroDelTiempo } from "./projection-rebuild.js";
import { registrarTrabajadorProyector } from "./projector-worker.js";

const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});

async function crearMascotas(cantidad) {
    const dueno = await crearDuenoAislado(rastreador);
    const creadas = [];
    for (let i = 0; i < cantidad; i++) {
        creadas.push(await crearMascotaAislada(rastreador, dueno.id));
    }
    return creadas;
}

describe("reconstruirProyecciones", () => {
    it("proyecta las mascotas que existían antes del proyector, sin que nadie las toque", async () => {
        const creadas = await crearMascotas(3);
        const ports = { cola: new AdaptadorColaEnMemoria(), proyeccion: new AdaptadorProyeccionEnMemoria() };
        registrarTrabajadorProyector(ports);

        const resultado = await reconstruirProyecciones(ports, { tamanoPagina: 2 });
        await ports.cola.esperarVacia();

        expect(resultado.siguiente).toBeNull();
        for (const mascota of creadas) {
            expect(ports.proyeccion.obtener(mascota.tokenQr)?.tokenQr).toBe(mascota.tokenQr);
        }
    });

    it("se puede interrumpir y seguir: cada llamada devuelve dónde quedó y no repite lo ya encolado", async () => {
        await crearMascotas(5);
        const encolados = [];
        const ports = { cola: { enqueue: (_tema, { idMascota }) => void encolados.push(idMascota) } };

        const primera = await reconstruirProyecciones(ports, { tamanoPagina: 2, maximoPaginas: 1 });
        expect(primera.encolados).toBe(2);
        expect(primera.siguiente).toBe(encolados[1]);

        let siguiente = primera.siguiente;
        while (siguiente) {
            ({ siguiente } = await reconstruirProyecciones(ports, { despues: siguiente, tamanoPagina: 2, maximoPaginas: 1 }));
        }
        expect(new Set(encolados).size).toBe(encolados.length);
    });

    it("si encolar una mascota falla, lo cuenta y sigue con las demás", async () => {
        await crearMascotas(3);
        let llamadas = 0;
        const ports = { cola: { enqueue: () => { if (++llamadas === 2) throw new Error("SQS no responde"); } } };
        const resultado = await reconstruirProyecciones(ports, { tamanoPagina: 100 });
        expect(resultado.fallidos).toBe(1);
        expect(resultado.encolados).toBeGreaterThanOrEqual(2);
    });

    it("en una Lambda se detiene al acercarse el límite de tiempo y devuelve dónde seguir", async () => {
        await crearMascotas(3);
        const ports = { cola: { enqueue: () => {} } };
        // El tiempo restante se agota tras la primera página.
        const tiempos = [60_000, 1_000];
        const resultado = await reconstruirProyeccionesDentroDelTiempo(ports, { tamanoPagina: 1, milisegundosRestantes: () => tiempos.shift() ?? 0 });
        expect(resultado.siguiente).not.toBeNull();
        expect(resultado.encolados).toBe(2);
    });
});
