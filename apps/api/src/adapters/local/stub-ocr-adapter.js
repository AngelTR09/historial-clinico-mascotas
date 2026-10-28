import { config } from "../../config.js";
/**
 * Stub: nunca llama a Textract. Respeta el feature flag `OCR_ENABLED`
 * (sección 11): con la cuota apagada, el resultado es 'omitido' sin
 * costo. Cuando está prendida, devuelve un resultado fijo de confianza
 * baja para poder probar el flujo de curaduría sin gastar cuota real.
 */
export class AdaptadorOcrSimulado {
    async extractText(_input) {
        if (!config.OCR_ENABLED) {
            return { status: "omitido", payload: null, confidence: null };
        }
        return {
            status: "procesado",
            payload: { engine: "stub", nota: "resultado fijo, no es OCR real" },
            confidence: 0.35,
        };
    }
}
