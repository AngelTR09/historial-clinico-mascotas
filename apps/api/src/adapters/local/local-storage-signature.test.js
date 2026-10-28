import "../../env.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { firmaAlmacenamientoValida, urlAlmacenamientoFirmada } from "./local-storage-signature.js";
function partesDe(url) {
    const { searchParams } = new URL(url);
    return { expires: searchParams.get("expires"), sig: searchParams.get("sig") };
}
afterEach(() => {
    vi.useRealTimers();
});
describe("firma de URLs de almacenamiento local", () => {
    it("acepta una URL recién firmada para el mismo método y clave", () => {
        const { expires, sig } = partesDe(urlAlmacenamientoFirmada("GET", "adjuntos/abc.png", 60).url);
        expect(firmaAlmacenamientoValida("GET", "adjuntos/abc.png", expires, sig)).toBe(true);
    });
    it("rechaza otra clave, otro método o una firma alterada", () => {
        const { expires, sig } = partesDe(urlAlmacenamientoFirmada("GET", "adjuntos/abc.png", 60).url);
        expect(firmaAlmacenamientoValida("GET", "adjuntos/otra.png", expires, sig)).toBe(false);
        expect(firmaAlmacenamientoValida("PUT", "adjuntos/abc.png", expires, sig)).toBe(false);
        // Cambia el último carácter por uno distinto; poner siempre "0" no altera la firma 1 de cada 16 veces.
        const alterada = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
        expect(firmaAlmacenamientoValida("GET", "adjuntos/abc.png", expires, alterada)).toBe(false);
    });
    it("rechaza extender la expiración sin volver a firmar", () => {
        const { expires, sig } = partesDe(urlAlmacenamientoFirmada("GET", "adjuntos/abc.png", 60).url);
        expect(firmaAlmacenamientoValida("GET", "adjuntos/abc.png", String(Number(expires) + 3600), sig)).toBe(false);
    });
    it("rechaza una URL expirada", () => {
        vi.useFakeTimers();
        const { expires, sig } = partesDe(urlAlmacenamientoFirmada("GET", "adjuntos/abc.png", 60).url);
        vi.advanceTimersByTime(61_000);
        expect(firmaAlmacenamientoValida("GET", "adjuntos/abc.png", expires, sig)).toBe(false);
    });
    it("rechaza parámetros ausentes o mal formados", () => {
        expect(firmaAlmacenamientoValida("GET", "k", undefined, undefined)).toBe(false);
        expect(firmaAlmacenamientoValida("GET", "k", "no-es-numero", "abc")).toBe(false);
    });
});
