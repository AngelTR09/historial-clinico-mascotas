import { z } from "zod";
import { NIVELES_CONFIANZA } from "../constants.js";
import { esquemaFechaIso, esquemaTextoNoVacio } from "./primitives.js";
/**
 * Una vacuna tal como se muestra en la ficha pública: solo qué es, cuándo
 * se aplicó y qué tan respaldada está. Sin `nombreProfesional` ni adjuntos.
 */
export const esquemaVacunaPublica = z.object({
    nombre: esquemaTextoNoVacio,
    fecha: z.string(),
    nivelConfianza: z.enum(NIVELES_CONFIANZA),
});
/**
 * Modelo de lectura del canal público (RF 21), proyección desnormalizada
 * en `hcm-public-profile` (PK `tokenQr`). Deliberadamente no incluye
 * `id`, `idDueno` ni `codigoPublico`: RN 1 prohíbe que el QR exponga el
 * código de identificación, y RN 5 prohíbe datos personales del dueño en
 * este canal (sin documento, dirección, teléfono ni correo).
 */
export const esquemaPerfilPublicoMascota = z.object({
    tokenQr: z.string(),
    nombreMascota: z.string().nullable(),
    especie: esquemaTextoNoVacio,
    urlFoto: z.string().url().nullable(),
    raza: z.string().nullable(),
    sexo: z.string().nullable(),
    edadMeses: z.number().int().nonnegative().nullable(),
    // Solo si tiene chip, nunca el número: identificaría al animal fuera de la placa.
    // Datos que rellena el dueño para identificar y cuidar al animal encontrado.
    colorSenas: z.string().nullable(),
    // null = sin dato.
    esterilizada: z.boolean().nullable(),
    // Solo con autorización expresa del dueño; si no, siempre null.
    alertasMedicas: z.string().nullable(),
    temperamento: z.string().nullable(),
    notaDelDueno: z.string().nullable(),
    // Solo fecha, sin lugar. null si no está extraviada.
    extraviadaDesde: esquemaFechaIso.nullable(),
    vacunas: z.array(esquemaVacunaPublica),
    estadoVacunacion: z.enum(["al_dia", "atrasado", "sin_registro"]),
    estaExtraviada: z.boolean(),
    mensajeContacto: z.string().nullable(),
    actualizadoEn: z.string().datetime({ offset: true }),
});
/**
 * Lo que puede enviar un tercero desde el formulario de contacto
 * enmascarado del canal público (RN 5): nunca un teléfono o correo
 * directo del dueño, solo un mensaje que el backend enruta.
 */
export const esquemaSolicitudContactoPublico = z.object({
    tokenQr: z.string(),
    nombreContacto: esquemaTextoNoVacio,
    canalContacto: z.string().min(6),
    mensaje: z.string().trim().min(1).max(1000),
});
