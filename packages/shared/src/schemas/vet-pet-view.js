import { z } from "zod";
import { ESTADOS_MASCOTA } from "../constants.js";
import { estadoOcrSchema } from "./attachment.js";
import { nivelConfianzaSchema, tipoEventoSaludSchema } from "./health-event.js";
import { esquemaId, esquemaFechaIso, esquemaFechaHoraIso } from "./primitives.js";

/**
 * Vista del veterinario tras escanear el QR (RF 13, RN 10). A propósito no
 * hay ningún campo del dueño (documento, teléfono, correo, nombres, id) ni
 * el `tokenQr`: los esquemas son `strict` para que un campo de más falle
 * en las pruebas en vez de filtrarse en silencio (RN 5).
 */

/** Evidencia de un evento: sin `claveS3` (interna); se lee con `urlLectura`, temporal. */
export const esquemaAdjuntoVeterinario = z
    .object({
    id: esquemaId,
    mime: z.string(),
    tamanoBytes: z.number().int().positive(),
    estadoOcr: estadoOcrSchema,
    confianzaOcr: z.number().min(0).max(1).nullable(),
    /** Texto extraído por OCR, resumido y truncado. `null` si no hay. */
    resumenOcr: z.string().nullable(),
    urlLectura: z.string().url(),
    urlLecturaExpiraEn: esquemaFechaHoraIso,
    creadoEn: esquemaFechaHoraIso,
})
    .strict();

export const esquemaResumenEventoCorregido = z
    .object({
    fechaEvento: esquemaFechaIso,
    tipo: tipoEventoSaludSchema,
    textoOriginal: z.string(),
})
    .strict();

export const esquemaEventoVeterinario = z
    .object({
    id: esquemaId,
    tipo: tipoEventoSaludSchema,
    fechaEvento: esquemaFechaIso,
    textoOriginal: z.string(),
    /** Nombre de la vacuna canónica si el normalizador ya la vinculó. */
    nombreVacunaCanonica: z.string().nullable(),
    nombreProfesional: z.string().nullable(),
    nivelConfianza: nivelConfianzaSchema,
    /** Evento previo que este evento corrige (RN 2). */
    corrigeEventoId: esquemaId.nullable(),
    corrigeEvento: esquemaResumenEventoCorregido.nullable(),
    /** Evento posterior que corrige a este, si lo hay. */
    corregidoPorEventoId: esquemaId.nullable(),
    /** Instante en que se capturó el evento. */
    creadoEn: esquemaFechaHoraIso,
    adjuntos: z.array(esquemaAdjuntoVeterinario),
})
    .strict();

export const esquemaMascotaVeterinario = z
    .object({
    id: esquemaId,
    codigoPublico: z.string(),
    nombre: z.string(),
    especie: z.string(),
    raza: z.string().nullable(),
    sexo: z.string().nullable(),
    edadMeses: z.number().int().nonnegative().nullable(),
    estado: z.enum(ESTADOS_MASCOTA),
    urlFoto: z.string().url().nullable(),
})
    .strict();

/**
 * `GET /pets/:idMascota/vet-view`: ficha + historial completo. El veterinario ya no valida
 * lo que declara el dueño (RN 3): lo que él registra nace `verificado`, y lo del dueño se
 * distingue por su `nivelConfianza`.
 */
export const esquemaVistaVeterinarioMascota = z
    .object({
    mascota: esquemaMascotaVeterinario,
    historial: z.array(esquemaEventoVeterinario),
})
    .strict();
