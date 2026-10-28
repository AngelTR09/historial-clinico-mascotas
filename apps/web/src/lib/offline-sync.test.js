import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({
    api: { post: vi.fn(), putRaw: vi.fn() },
}));

import { api } from "../api/client";
import { encolarSubidaPendiente, eliminarSubidaPendiente, listarSubidasPendientes } from "./offline-queue";
import { sincronizarSubidasPendientes } from "./offline-sync";

function evento(creadoEn, sobrescrituras = {}) {
    const claveIdempotencia = crypto.randomUUID();
    return {
        clase: "evento-salud",
        id: claveIdempotencia,
        idMascota: "11111111-1111-4111-8111-111111111111",
        datos: { idMascota: "11111111-1111-4111-8111-111111111111", tipo: "chequeo", fechaEvento: "2026-09-01", textoOriginal: "Control", claveIdempotencia },
        creadoEn,
        intentos: 0,
        ultimoError: null,
        ...sobrescrituras,
    };
}

beforeEach(async () => {
    vi.resetAllMocks();
    for (const item of await listarSubidasPendientes()) await eliminarSubidaPendiente(item.id);
});

describe("sincronizarSubidasPendientes (RNF 9, RN 6)", () => {
    it("reenvía el evento con la MISMA clave de idempotencia generada al capturar y lo saca de la cola", async () => {
        const item = evento("2026-09-01T10:00:00.000Z");
        await encolarSubidaPendiente(item);
        api.post.mockResolvedValue({});
        const resultado = await sincronizarSubidasPendientes();
        expect(api.post).toHaveBeenCalledWith("/health-events", expect.objectContaining({ claveIdempotencia: item.datos.claveIdempotencia }));
        expect(resultado).toEqual({ sincronizados: 1, fallidos: 0 });
        expect(await listarSubidasPendientes()).toEqual([]);
    });

    it("sin red se detiene y conserva todo en la cola, sin marcarlo como error", async () => {
        await encolarSubidaPendiente(evento("2026-09-01T10:00:00.000Z"));
        await encolarSubidaPendiente(evento("2026-09-01T10:01:00.000Z"));
        api.post.mockRejectedValue(new TypeError("Failed to fetch"));
        const resultado = await sincronizarSubidasPendientes();
        expect(api.post).toHaveBeenCalledTimes(1);
        expect(resultado).toEqual({ sincronizados: 0, fallidos: 0 });
        const cola = await listarSubidasPendientes();
        expect(cola).toHaveLength(2);
        expect(cola.every((item) => item.ultimoError === null)).toBe(true);
    });

    it("un ítem inválido se marca con su error y no bloquea a los demás", async () => {
        await encolarSubidaPendiente(evento("2026-09-01T10:00:00.000Z"));
        await encolarSubidaPendiente(evento("2026-09-01T10:01:00.000Z"));
        api.post.mockRejectedValueOnce(new Error("Datos de entrada inválidos")).mockResolvedValueOnce({});
        const resultado = await sincronizarSubidasPendientes();
        expect(resultado).toEqual({ sincronizados: 1, fallidos: 1 });
        const cola = await listarSubidasPendientes();
        expect(cola).toHaveLength(1);
        expect(cola[0].ultimoError).toBe("Datos de entrada inválidos");
    });

    it("un adjunto sube por URL directa (el backend nunca recibe el binario) y luego se registra", async () => {
        await encolarSubidaPendiente({
            clase: "adjunto",
            id: crypto.randomUUID(),
            idMascota: "11111111-1111-4111-8111-111111111111",
            idEvento: "22222222-2222-4222-8222-222222222222",
            archivo: new Blob(["x"], { type: "image/png" }),
            mime: "image/png",
            tamanoBytes: 1,
            creadoEn: "2026-09-01T10:00:00.000Z",
            intentos: 0,
            ultimoError: null,
        });
        api.post.mockResolvedValueOnce({ clave: "k", url: "http://almacen/k" }).mockResolvedValueOnce({});
        await sincronizarSubidasPendientes();
        expect(api.putRaw).toHaveBeenCalledWith("http://almacen/k", expect.anything());
        expect(api.post).toHaveBeenLastCalledWith("/attachments", expect.objectContaining({ claveS3: "k" }));
    });
});
