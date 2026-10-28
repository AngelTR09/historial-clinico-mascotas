import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = path.resolve(import.meta.dirname);
const RAIZ_PUBLICO = path.resolve(RAIZ_SRC, "../public");
const LIMITE_BYTES = 150 * 1024;

function archivosFuente(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
        const ruta = path.join(dir, entrada.name);
        if (entrada.isDirectory()) return archivosFuente(ruta);
        return /\.(jsx?|css)$/.test(entrada.name) && !entrada.name.includes(".test.") ? [ruta] : [];
    });
}

/** Cada "/img/..." citado en el código debe existir en public/ y pesar poco: una imagen rota no la detecta ningún otro test. */
describe("imágenes del sitio", () => {
    const referencias = [...new Set(archivosFuente(RAIZ_SRC).flatMap((archivo) => [...readFileSync(archivo, "utf8").matchAll(/\/img\/[\w.-]+/g)].map((m) => m[0])))];

    it("el código referencia las imágenes esperadas", () => {
        expect(referencias.length).toBeGreaterThanOrEqual(6);
    });

    it.each(referencias)("%s existe y pesa menos de 150 KB", (ruta) => {
        const archivo = path.join(RAIZ_PUBLICO, ruta);
        expect(statSync(archivo).size).toBeGreaterThan(0);
        expect(statSync(archivo).size).toBeLessThan(LIMITE_BYTES);
    });
});
