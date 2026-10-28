/**
 * PuertoOcr — contrato que debe cumplir cualquier adaptador de OCR.
 * Procesamiento asíncrono y opcional (RN 8): nunca bloquea el registro
 * del evento.
 *
 *   extractText(input) -> Promise<ResultadoOcr>
 *     input: { claveS3, mime }
 *     ResultadoOcr: { status: "procesado" | "fallido" | "omitido", payload, confidence }
 */
export {};
