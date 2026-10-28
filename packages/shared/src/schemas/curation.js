import { z } from "zod";
import { ESTADOS_CURACION } from "../constants.js";
import { esquemaId, esquemaFechaHoraIso, esquemaTextoNoVacio } from "./primitives.js";
export const estadoCuracionSchema = z.enum(ESTADOS_CURACION);
/**
 * Fila de la cola de curaduría (sección 3, "curaduría"). La llena el
 * normalizador cuando no encuentra match para `texto_original` en el
 * catálogo canónico; no se crea ni se resuelve por API pública.
 */
export const esquemaRegistroColaCuracion = z.object({
    id: esquemaId,
    textoOriginal: esquemaTextoNoVacio,
    ocurrencias: z.number().int().positive(),
    sugerenciaId: esquemaId.nullable(),
    estado: estadoCuracionSchema,
    resueltoEn: esquemaFechaHoraIso.nullable(),
});
