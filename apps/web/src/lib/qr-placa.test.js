import { describe, expect, it } from "vitest";
import { extraerTokenQr } from "@hcm/shared";
import { generarSvgPlacaQr } from "./qr-placa";

describe("generarSvgPlacaQr", () => {
    const url = "https://hcm.test/p/AbCdEfGhIjKlMnOpQrStUv";

    it("es vectorial, en blanco y negro y con tamaño físico en milímetros", () => {
        const svg = generarSvgPlacaQr(url, { milimetros: 25 });
        expect(svg).toContain('width="25mm"');
        expect(svg).toContain('height="25mm"');
        expect(svg).toContain('fill="#000"');
        expect(svg).not.toMatch(/gradient|<image|opacity/);
        expect(svg.match(/<path /g)).toHaveLength(1);
    });

    it("deja la zona de silencio de 4 módulos y es cuadrado", () => {
        const svg = generarSvgPlacaQr(url);
        const [, lado] = svg.match(/viewBox="0 0 (\d+) \1"/);
        expect(Number(lado)).toBeGreaterThanOrEqual(21 + 8);
        const origenes = [...svg.matchAll(/M(\d+) (\d+)h/g)].map((m) => [Number(m[1]), Number(m[2])]);
        expect(Math.min(...origenes.map(([x]) => x))).toBeGreaterThanOrEqual(4);
        expect(Math.max(...origenes.map(([x]) => x))).toBeLessThanOrEqual(Number(lado) - 5);
    });

    it("la URL que codifica devuelve el token opaco (RN 1)", () => {
        expect(extraerTokenQr(url)).toBe("AbCdEfGhIjKlMnOpQrStUv");
    });
});
