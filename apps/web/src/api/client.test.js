// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { establecerToken, limpiarToken } from "../lib/auth-storage";
import { api, ErrorApi } from "./client";

function responder(estado, cuerpo) {
    return vi.fn().mockResolvedValue({
        ok: estado >= 200 && estado < 300,
        status: estado,
        statusText: "x",
        json: async () => {
            if (cuerpo === undefined) throw new Error("sin cuerpo");
            return cuerpo;
        },
    });
}

beforeEach(() => limpiarToken());
afterEach(() => vi.unstubAllGlobals());

describe("cliente HTTP", () => {
    it("envía el token del dueño como Bearer", async () => {
        establecerToken("abc");
        const fetchFalso = responder(200, { ok: true });
        vi.stubGlobal("fetch", fetchFalso);
        await api.get("/pets");
        expect(fetchFalso.mock.calls[0][1].headers.Authorization).toBe("Bearer abc");
    });

    it("un token explícito (veterinario) tiene prioridad sobre el del dueño", async () => {
        establecerToken("dueno");
        const fetchFalso = responder(200, {});
        vi.stubGlobal("fetch", fetchFalso);
        await api.get("/vets/me", { token: "vet" });
        expect(fetchFalso.mock.calls[0][1].headers.Authorization).toBe("Bearer vet");
    });

    it("un token explícito null no filtra el token del dueño", async () => {
        establecerToken("dueno");
        const fetchFalso = responder(200, {});
        vi.stubGlobal("fetch", fetchFalso);
        await api.get("/x", { token: null });
        expect(fetchFalso.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });

    it("manda JSON con Content-Type solo cuando hay cuerpo", async () => {
        const fetchFalso = responder(201, {});
        vi.stubGlobal("fetch", fetchFalso);
        await api.post("/owners", { a: 1 });
        expect(fetchFalso.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");
        expect(fetchFalso.mock.calls[0][1].body).toBe('{"a":1}');
    });

    it("convierte un error del API en ErrorApi con su mensaje y estado", async () => {
        vi.stubGlobal("fetch", responder(403, { error: "La mascota no pertenece a este dueño" }));
        await expect(api.get("/pets/1")).rejects.toMatchObject({ name: "ErrorApi", status: 403, message: "La mascota no pertenece a este dueño" });
    });

    it("tolera una respuesta de error sin JSON (p. ej. un 502 del balanceador)", async () => {
        vi.stubGlobal("fetch", responder(502, undefined));
        await expect(api.get("/pets")).rejects.toBeInstanceOf(ErrorApi);
    });

    it("una respuesta 204 no intenta leer JSON", async () => {
        vi.stubGlobal("fetch", responder(204, undefined));
        await expect(api.post("/x")).resolves.toBeUndefined();
    });
});
