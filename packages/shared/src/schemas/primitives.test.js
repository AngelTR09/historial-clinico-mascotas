import { z } from "zod";
import { describe, expect, it } from "vitest";
import { textoOpcional } from "./primitives.js";
describe("textoOpcional", () => {
    const esquema = z.object({ valor: textoOpcional(z.string().trim().min(1).optional()) });
    it("trata la cadena vacía de un <input> HTML como ausente, no como inválida", () => {
        // Este es exactamente el bug real que motivó el helper: un campo
        // "opcional" en un formulario real llega como "" (nunca `undefined`),
        // y sin este preprocess, z.string().min(1).optional() lo rechazaba en
        // silencio porque .optional() solo exime a `undefined`.
        const resultado = esquema.safeParse({ valor: "" });
        expect(resultado.success).toBe(true);
        expect(resultado.success && resultado.data.valor).toBeUndefined();
    });
    it("también trata una cadena de solo espacios como ausente", () => {
        const resultado = esquema.safeParse({ valor: "   " });
        expect(resultado.success).toBe(true);
        expect(resultado.success && resultado.data.valor).toBeUndefined();
    });
    it("sigue validando un valor real normalmente", () => {
        const resultado = esquema.safeParse({ valor: "Dr. Pérez" });
        expect(resultado.success).toBe(true);
        expect(resultado.success && resultado.data.valor).toBe("Dr. Pérez");
    });
    it("sigue aceptando el campo completamente ausente", () => {
        const resultado = esquema.safeParse({});
        expect(resultado.success).toBe(true);
        expect(resultado.success && resultado.data.valor).toBeUndefined();
    });
});
