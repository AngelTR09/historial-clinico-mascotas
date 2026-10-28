import { z } from "zod";
import { ESTADOS_OCR } from "../constants.js";
import { esquemaId, esquemaFechaHoraIso } from "./primitives.js";
export const estadoOcrSchema = z.enum(ESTADOS_OCR);
export const esquemaAdjunto = z.object({
    id: esquemaId,
    idEvento: esquemaId,
    claveS3: z.string(),
    mime: z.string(),
    tamanoBytes: z.number().int().positive(),
    estadoOcr: estadoOcrSchema,
    datosOcr: z.record(z.unknown()).nullable(),
    confianzaOcr: z.number().min(0).max(1).nullable(),
    creadoEn: esquemaFechaHoraIso,
});
/**
 * Confirmación de evidencia (RF 06), posterior a subir el binario
 * directo a S3 vía `StoragePort.getUploadUrl` (RN: el backend nunca
 * recibe el archivo). `estadoOcr` arranca en 'pendiente' y el
 * procesamiento es asíncrono y opcional; nunca bloquea esta escritura
 * (RN 8).
 */
export const esquemaCreacionAdjunto = z.object({
    idEvento: esquemaId,
    claveS3: z.string().min(1),
    mime: z.string().min(1),
    tamanoBytes: z.number().int().positive(),
});
