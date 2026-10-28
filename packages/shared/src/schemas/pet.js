import { z } from "zod";
import { ESTADOS_MASCOTA } from "../constants.js";
import { esquemaFechaIso, esquemaFechaHoraIso, esquemaId, esquemaTextoNoVacio, textoOpcional, textoPublicoEditable, esquemaUbigeo } from "./primitives.js";
export const estadoMascotaSchema = z.enum(ESTADOS_MASCOTA);
/**
 * Vista completa de la mascota para su dueño autenticado. Incluye
 * `tokenQr`: el dueño lo necesita para reimprimir su propia placa. RN 1
 * solo prohíbe que el `codigoPublico` viaje junto al token en el canal
 * público (ver `pet-public-profile.js`), no que el dueño vea ambos.
 */
export const esquemaMascota = z.object({
    id: esquemaId,
    idDueno: esquemaId,
    codigoPublico: z.string(),
    tokenQr: z.string(),
    nombre: esquemaTextoNoVacio,
    especie: esquemaTextoNoVacio,
    raza: z.string().trim().min(1).nullable(),
    sexo: z.string().trim().min(1).nullable(),
    fechaNacimientoAprox: esquemaFechaIso.nullable(),
    claveFoto: z.string().nullable(),
    /** URL temporal de lectura de la foto; la agrega el API al listar, no se guarda. */
    urlFoto: z.string().url().nullable().optional(),
    estado: estadoMascotaSchema,
    ubigeoDistrito: esquemaUbigeo.nullable(),
    colorSenas: z.string().nullable(),
    esterilizada: z.boolean().nullable(),
    alertasMedicas: z.string().nullable(),
    alertasMedicasPublicas: z.boolean(),
    temperamento: z.string().nullable(),
    notaDelDueno: z.string().nullable(),
    extraviadaDesde: esquemaFechaIso.nullable(),
    creadoEn: esquemaFechaHoraIso,
});
/** Alta de mascota (RF 02). `codigoPublico`, `tokenQr` y `estado` los asigna el backend. */
export const esquemaCreacionMascota = z.object({
    nombre: esquemaTextoNoVacio,
    especie: esquemaTextoNoVacio,
    raza: textoOpcional(z.string().trim().min(1).optional()),
    sexo: textoOpcional(z.string().trim().min(1).optional()),
    fechaNacimientoAprox: textoOpcional(esquemaFechaIso.optional()),
    claveFoto: z.string().optional(),
    ubigeoDistrito: textoOpcional(esquemaUbigeo.optional()),
});
/**
 * Alta de camada: hasta 8 expedientes en un solo envío, transaccional
 * (sección 10 y 12 — nunca inserciones sueltas que puedan dejar crías
 * huérfanas si falla a mitad).
 */
export const esquemaCreacionCamada = z.object({
    mascotas: z.array(esquemaCreacionMascota).min(1).max(8),
});
/**
 * Carga masiva de albergue: hasta 100 expedientes (sección 10). A esta
 * escala no es transaccional como la camada — va por cola, procesada de a
 * una para no bloquear las escrituras del resto (sección 12). No hay un
 * actor "albergue" en el modelo: es un dueño más, usando este endpoint en
 * vez del alta individual o de la camada.
 */
export const esquemaCargaMasivaMascotas = z.object({
    mascotas: z.array(esquemaCreacionMascota).min(1).max(100),
});
/**
 * Estados que el propio dueño puede fijar directamente. `transferida` queda
 * fuera: solo la asigna el flujo de transferencia de dueño (`transfers`),
 * que todavía no existe.
 */
export const estadoMascotaEditableSchema = z.enum(["activa", "extraviada", "fallecida"]);
/** RF: reportar una mascota como extraviada (o recuperada) desde su ficha. */
export const esquemaActualizacionEstadoMascota = z.object({
    estado: estadoMascotaEditableSchema,
});

/** Límites de los textos libres que el dueño publica en la ficha del QR. */
export const LIMITE_COLOR_SENAS = 200;
export const LIMITE_ALERTAS_MEDICAS = 300;
export const LIMITE_TEMPERAMENTO = 120;
export const LIMITE_NOTA_DEL_DUENO = 280;

/**
 * Edición por el dueño de los datos que ayudan a identificar y cuidar al
 * animal si se extravía. Todos opcionales: `undefined` conserva el valor,
 * `null` (o cadena vacía) lo borra. `extraviadaDesde` no se edita aquí: lo
 * fija el cambio de estado. Los textos rechazan correos y secuencias de 7 o
 * más dígitos porque la ficha pública no puede exponer datos personales (RN 5).
 */
export const esquemaActualizacionMascota = z
    .object({
    colorSenas: textoPublicoEditable(LIMITE_COLOR_SENAS),
    esterilizada: z.boolean().nullable().optional(),
    alertasMedicas: textoPublicoEditable(LIMITE_ALERTAS_MEDICAS),
    alertasMedicasPublicas: z.boolean().optional(),
    temperamento: textoPublicoEditable(LIMITE_TEMPERAMENTO),
    notaDelDueno: textoPublicoEditable(LIMITE_NOTA_DEL_DUENO),
})
    .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), { message: "No hay ningún dato para actualizar" });

/** Tipos de imagen aceptados para la foto de perfil de la mascota (la que sale en la ficha del QR). */
export const MIMES_FOTO_MASCOTA = ["image/jpeg", "image/png", "image/webp"];
/** Paso 1 de la foto: el cliente pide dónde subir el binario (nunca pasa por el backend). */
export const esquemaSolicitudSubidaFoto = z.object({
    mime: z.enum(MIMES_FOTO_MASCOTA),
});
/** Paso 3 de la foto: el cliente confirma la clave ya subida para fijarla como foto de la mascota. */
export const esquemaConfirmacionFoto = z.object({
    clave: z.string().min(1).max(200),
});
