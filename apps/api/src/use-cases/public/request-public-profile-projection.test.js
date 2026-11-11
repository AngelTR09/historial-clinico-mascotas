import "../../env.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { crearDuenoYMascotaAislados, crearRastreadorFixtures, limpiarFixtures } from "../../test-support/fixtures.js";
import { solicitarProyeccionPerfilPublico } from "./request-public-profile-projection.js";

const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    vi.restoreAllMocks();
    await limpiarFixtures(rastreador);
});

function proyeccionQueAnota() {
    const guardados = [];
    return { guardados, proyeccion: { guardarPerfil: async (token, perfil) => void guardados.push({ token, perfil }) } };
}

describe("solicitarProyeccionPerfilPublico", () => {
    it("encola el tema del proyector con la mascota", async () => {
        const encolados = [];
        await solicitarProyeccionPerfilPublico({ cola: { enqueue: (topic, payload) => encolados.push({ topic, payload }) } }, "m1");
        expect(encolados).toEqual([{ topic: "projector", payload: { idMascota: "m1" } }]);
    });

    it("devuelve la promesa del envío: una Lambda la espera antes de congelarse", async () => {
        let enviado = false;
        const cola = { enqueue: () => new Promise((resolver) => setTimeout(() => { enviado = true; resolver(); }, 20)) };
        await solicitarProyeccionPerfilPublico({ cola }, "m1");
        expect(enviado).toBe(true);
    });

    it("si la cola lanza, no rompe la escritura que la llamó (RN 8)", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const ports = { cola: { enqueue: () => { throw new Error("cola sin configurar"); } } };
        await expect(solicitarProyeccionPerfilPublico(ports, "m1")).resolves.toBeUndefined();
        expect(error).toHaveBeenCalledOnce();
    });

    it("si el envío a la cola se rechaza (SQS caído), la promesa tampoco rechaza", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const ports = { cola: { enqueue: () => Promise.reject(new Error("SQS no responde")) } };
        await expect(solicitarProyeccionPerfilPublico(ports, "m1")).resolves.toBeUndefined();
    });

    it("con la cola caída, la API proyecta la ficha directamente para que no quede desactualizada", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const { idMascota, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const { guardados, proyeccion } = proyeccionQueAnota();
        await solicitarProyeccionPerfilPublico({ cola: { enqueue: () => Promise.reject(new Error("SQS no responde")) }, proyeccion }, idMascota);
        expect(guardados).toHaveLength(1);
        expect(guardados[0].token).toBe(tokenQr);
        expect(guardados[0].perfil.tokenQr).toBe(tokenQr);
    });

    it("con la cola funcionando no se proyecta dos veces", async () => {
        const { guardados, proyeccion } = proyeccionQueAnota();
        await solicitarProyeccionPerfilPublico({ cola: { enqueue: async () => {} }, proyeccion }, "m1");
        expect(guardados).toEqual([]);
    });

    it("si fallan la cola y la proyección directa, queda registrado y nada se propaga", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const ports = { cola: { enqueue: () => Promise.reject(new Error("SQS no responde")) }, proyeccion: { guardarPerfil: async () => { throw new Error("DynamoDB no responde"); } } };
        await expect(solicitarProyeccionPerfilPublico(ports, idMascota)).resolves.toBeUndefined();
        expect(error).toHaveBeenCalledOnce();
    });
});
