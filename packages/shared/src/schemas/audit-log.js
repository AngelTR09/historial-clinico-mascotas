import { z } from "zod";
import { TIPOS_ACTOR_AUDITORIA } from "../constants.js";
import { esquemaId, esquemaFechaHoraIso, esquemaTextoNoVacio } from "./primitives.js";
export const tipoActorAuditoriaSchema = z.enum(TIPOS_ACTOR_AUDITORIA);
/**
 * Entrada de auditoría (RN 9: toda lectura y escritura sobre un
 * expediente se audita, retención mínima 5 años). La genera siempre el
 * backend; no existe esquema de creación por API.
 */
export const esquemaRegistroAuditoria = z.object({
    id: esquemaId,
    tipoActor: tipoActorAuditoriaSchema,
    idActor: esquemaId.nullable(),
    idMascota: esquemaId.nullable(),
    accion: esquemaTextoNoVacio,
    hashIp: z.string(),
    ocurridoEn: esquemaFechaHoraIso,
});
