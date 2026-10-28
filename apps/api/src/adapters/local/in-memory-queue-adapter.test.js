import { afterEach, describe, expect, it, vi } from "vitest";
import { AdaptadorColaEnMemoria } from "./in-memory-queue-adapter.js";

afterEach(() => vi.restoreAllMocks());

describe("AdaptadorColaEnMemoria", () => {
    it("procesa el payload de forma diferida, sin bloquear el enqueue", async () => {
        const cola = new AdaptadorColaEnMemoria();
        const recibidos = [];
        const procesado = new Promise((resolve) => {
            cola.subscribe("ocr", async (payload) => {
                recibidos.push(payload);
                resolve();
            });
        });
        cola.enqueue("ocr", 42);
        expect(recibidos).toHaveLength(0);
        await procesado;
        expect(recibidos).toEqual([42]);
    });

    it("sin configuración no reintenta: un fallo queda en la DLQ tras un solo intento", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const cola = new AdaptadorColaEnMemoria();
        let intentos = 0;
        cola.subscribe("bulk", async () => {
            intentos++;
            throw new Error("falló");
        });
        cola.enqueue("bulk", { a: 1 });
        await cola.esperarVacia();
        expect(intentos).toBe(1);
        expect(cola.fallidos("bulk")).toEqual([{ payload: { a: 1 }, error: "falló", intentos: 1 }]);
    });

    it("reintenta hasta el máximo del tema y se recupera si un intento tiene éxito", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const cola = new AdaptadorColaEnMemoria({ maximoIntentosPorTema: { reminder: 3 } });
        let intentos = 0;
        cola.subscribe("reminder", async () => {
            intentos++;
            if (intentos < 3) throw new Error("transitorio");
        });
        cola.enqueue("reminder", {});
        await cola.esperarVacia();
        expect(intentos).toBe(3);
        expect(cola.fallidos("reminder")).toHaveLength(0);
    });

    it("agotados los intentos el mensaje pasa a la DLQ y no se imprime su payload (RN 5)", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const cola = new AdaptadorColaEnMemoria({ maximoIntentosPorTema: { reminder: 3 } });
        let intentos = 0;
        cola.subscribe("reminder", async () => {
            intentos++;
            throw new Error("SNS caído");
        });
        cola.enqueue("reminder", { to: "dueno@example.com" });
        await cola.esperarVacia();
        expect(intentos).toBe(3);
        expect(cola.fallidos("reminder")).toHaveLength(1);
        expect(JSON.stringify(error.mock.calls)).not.toContain("dueno@example.com");
    });
});
