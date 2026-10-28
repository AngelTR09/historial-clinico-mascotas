import { z } from "zod";
import { esquemaId, esquemaFechaIso, esquemaTextoNoVacio } from "./primitives.js";
/** Recordatorio de vencimiento de una vacuna o desparasitación, tal como lo ve el dueño en su dashboard. */
export const esquemaRecordatorio = z.object({
    idMascota: esquemaId,
    nombreMascota: esquemaTextoNoVacio,
    /** Nombre de lo que vence: la vacuna canónica o "Desparasitación". */
    vacuna: esquemaTextoNoVacio,
    tipo: z.enum(["vacuna", "desparasitacion"]).default("vacuna"),
    vencimiento: esquemaFechaIso,
});
