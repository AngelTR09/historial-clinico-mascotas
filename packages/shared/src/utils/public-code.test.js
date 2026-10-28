import { describe, expect, it } from "vitest";
import { calcularDigitoVerificador, formatearCodigoPublico, esCodigoPublicoValido, LONGITUD_CODIGO_PUBLICO } from "./public-code.js";
describe("public-code", () => {
    it("genera un código de la longitud esperada", () => {
        const codigo = formatearCodigoPublico("000000001");
        expect(codigo).toHaveLength(LONGITUD_CODIGO_PUBLICO);
    });
    it("el código generado es válido", () => {
        expect(esCodigoPublicoValido(formatearCodigoPublico("123456789"))).toBe(true);
    });
    it("detecta un dígito verificador alterado", () => {
        const base = "123456789";
        const digito = calcularDigitoVerificador(base);
        const digitoIncorrecto = String((Number(digito) + 1) % 10);
        expect(esCodigoPublicoValido(`${base}${digitoIncorrecto}`)).toBe(false);
    });
    it("rechaza una base que no sea numérica", () => {
        expect(() => calcularDigitoVerificador("12345678a")).toThrow();
    });
    it("rechaza un código con longitud incorrecta", () => {
        expect(esCodigoPublicoValido("123")).toBe(false);
    });
});
