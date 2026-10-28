import { z } from "zod";
import { ESTADOS_TRANSFERENCIA } from "../constants.js";
import { esquemaId, esquemaFechaHoraIso } from "./primitives.js";
export const estadoTransferenciaSchema = z.enum(ESTADOS_TRANSFERENCIA);
/** `hashCodigo` es el hash del código de una sola vez; el código en claro nunca se persiste. */
export const esquemaTransferencia = z.object({
    id: esquemaId,
    idMascota: esquemaId,
    idDuenoOrigen: esquemaId,
    idDuenoDestino: esquemaId.nullable(),
    hashCodigo: z.string(),
    expiraEn: esquemaFechaHoraIso,
    estado: estadoTransferenciaSchema,
});
/** Inicio de transferencia: solo el dueño actual, indicando qué mascota cede. */
export const esquemaCreacionTransferencia = z.object({
    idMascota: esquemaId,
});
/** Canje del código de una sola vez por el dueño entrante. */
export const esquemaCanjeTransferencia = z.object({
    idTransferencia: esquemaId,
    codigo: z.string().min(6),
});
