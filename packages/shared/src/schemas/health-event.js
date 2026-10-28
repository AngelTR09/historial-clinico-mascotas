import { z } from "zod";
import { NIVELES_CONFIANZA, TIPOS_EVENTO_SALUD } from "../constants.js";
import { esquemaClaveIdempotencia, esquemaId, esquemaFechaIso, esquemaFechaHoraIso, esquemaTextoNoVacio, textoOpcional } from "./primitives.js";
export const tipoEventoSaludSchema = z.enum(TIPOS_EVENTO_SALUD);
export const nivelConfianzaSchema = z.enum(NIVELES_CONFIANZA);
export const esquemaEventoSalud = z.object({
    id: esquemaId,
    idMascota: esquemaId,
    tipo: tipoEventoSaludSchema,
    fechaEvento: esquemaFechaIso,
    textoOriginal: esquemaTextoNoVacio,
    vacunaCanonicaId: esquemaId.nullable(),
    nombreProfesional: z.string().trim().min(1).nullable(),
    nivelConfianza: nivelConfianzaSchema,
    corrigeEventoId: esquemaId.nullable(),
    claveIdempotencia: esquemaClaveIdempotencia,
    // Exactamente uno de los dos: el dueño que lo declaró o el veterinario que lo registró (RN 3).
    creadoPor: esquemaId.nullable(),
    creadoPorVeterinario: esquemaId.nullable(),
    creadoEn: esquemaFechaHoraIso,
});
/**
 * Registro de evento por el dueño. `claveIdempotencia` se genera en el cliente al momento
 * de la captura, no al enviar (RN 6). `vacunaCanonicaId` y
 * `nivelConfianza` los completa el backend/normalizador, no el cliente.
 * `corrigeEventoId` solo aplica cuando este evento reemplaza a uno
 * previamente validado e inmutable (RN 2).
 */
export const esquemaCreacionEventoSalud = z.object({
    idMascota: esquemaId,
    tipo: tipoEventoSaludSchema,
    fechaEvento: esquemaFechaIso,
    textoOriginal: esquemaTextoNoVacio,
    nombreProfesional: textoOpcional(z.string().trim().min(1).optional()),
    corrigeEventoId: esquemaId.optional(),
    claveIdempotencia: esquemaClaveIdempotencia,
});

/**
 * Registro de evento por un veterinario con acceso a la mascota (RN 3, RNF 01 y 04). La
 * mascota sale de la URL y el nombre del profesional, de su cuenta: el cliente no los
 * manda. El evento nace `verificado` (decidido 2026-10-21).
 */
export const esquemaCreacionEventoSaludVeterinario = esquemaCreacionEventoSalud.omit({ idMascota: true, nombreProfesional: true });
