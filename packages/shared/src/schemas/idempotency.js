import { z } from "zod";
import { esquemaClaveIdempotencia, esquemaFechaHoraIso } from "./primitives.js";
/**
 * Forma de una fila en `hcm-idempotency` (PK `claveIdempotencia`, TTL 7
 * días). `cuerpoRespuesta` es la respuesta ya servida la primera vez, para
 * devolverla igual ante un reintento del cliente (RN 6).
 */
export const esquemaRegistroIdempotencia = z.object({
    claveIdempotencia: esquemaClaveIdempotencia,
    estadoRespuesta: z.number().int(),
    cuerpoRespuesta: z.unknown(),
    creadoEn: esquemaFechaHoraIso,
    ttl: z.number().int().positive(),
});
