import { describe, expect, it } from "vitest";
import { mejorCoincidenciaVacuna, normalizarTexto, similitudTexto } from "./similarity.js";
describe("normalizarTexto", () => {
    it("quita tildes, pasa a minúsculas y colapsa espacios", () => {
        expect(normalizarTexto("Vacuna Antirrábica")).toBe("vacuna antirrabica");
        expect(normalizarTexto("  Séxtuple   canina  ")).toBe("sextuple canina");
    });
});
describe("similitudTexto", () => {
    it("da 1 cuando un texto contiene al otro tras quitar 'vacuna'/tildes", () => {
        expect(similitudTexto("vacuna antirrabica", "Antirrábica")).toBe(1);
        expect(similitudTexto("Antirrábica", "Antirrábica")).toBe(1);
    });
    it("da un puntaje alto para variantes con errores menores de tipeo", () => {
        expect(similitudTexto("antirabica", "Antirrábica")).toBeGreaterThan(0.7);
    });
    it("da un puntaje bajo para textos sin relación", () => {
        expect(similitudTexto("no se el nombre exacto", "Antirrábica")).toBeLessThan(0.4);
    });
    it("da 0 si algún texto queda vacío tras normalizar (solo stopwords)", () => {
        expect(similitudTexto("vacuna de la", "Antirrábica")).toBe(0);
    });
});
describe("mejorCoincidenciaVacuna", () => {
    const candidates = [
        { id: "1", nombreCanonico: "Antirrábica" },
        { id: "2", nombreCanonico: "Séxtuple canina" },
    ];
    it("elige el candidato con mayor similitud", () => {
        const match = mejorCoincidenciaVacuna("vacuna antirrabica", candidates);
        expect(match?.candidate.id).toBe("1");
        expect(match?.score).toBe(1);
    });
    it("devuelve null si no hay candidatos", () => {
        expect(mejorCoincidenciaVacuna("Antirrábica", [])).toBeNull();
    });
});
