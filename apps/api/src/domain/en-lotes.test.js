import { describe, expect, it } from "vitest";
import { ejecutarEnLotes } from "./en-lotes.js";

describe("ejecutarEnLotes", () => {
    it("nunca tiene más tareas en vuelo que el tamaño del lote", async () => {
        let enVuelo = 0;
        let maximo = 0;
        await ejecutarEnLotes([1, 2, 3, 4, 5, 6, 7], 3, async () => {
            enVuelo++;
            maximo = Math.max(maximo, enVuelo);
            await new Promise((r) => setTimeout(r, 2));
            enVuelo--;
        });
        expect(maximo).toBe(3);
    });

    it("devuelve cada resultado en orden, también los fallos, y un fallo no corta a los demás", async () => {
        const resultados = await ejecutarEnLotes([1, 2, 3], 2, (n) => { if (n === 2) throw new Error("boom"); return n * 10; });
        expect(resultados.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
        expect(resultados[2].value).toBe(30);
    });
});
