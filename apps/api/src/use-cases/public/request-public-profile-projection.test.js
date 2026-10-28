import { afterEach, describe, expect, it, vi } from "vitest";
import { solicitarProyeccionPerfilPublico } from "./request-public-profile-projection.js";

afterEach(() => vi.restoreAllMocks());

describe("solicitarProyeccionPerfilPublico", () => {
    it("encola el tema del proyector con la mascota", () => {
        const encolados = [];
        solicitarProyeccionPerfilPublico({ cola: { enqueue: (topic, payload) => encolados.push({ topic, payload }) } }, "m1");
        expect(encolados).toEqual([{ topic: "projector", payload: { idMascota: "m1" } }]);
    });

    it("si la cola lanza, no rompe la escritura que la llamó (RN 8)", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const ports = { cola: { enqueue: () => { throw new Error("cola sin configurar"); } } };
        expect(() => solicitarProyeccionPerfilPublico(ports, "m1")).not.toThrow();
        expect(error).toHaveBeenCalledOnce();
    });
});
