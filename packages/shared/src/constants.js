export const NIVELES_CONFIANZA = ["declarado", "con_evidencia", "verificado"];
export const TIPOS_EVENTO_SALUD = ["vacuna", "chequeo", "tratamiento", "desparasitacion"];
export const ESTADOS_MASCOTA = ["activa", "extraviada", "fallecida", "transferida"];
export const ESTADOS_OCR = ["pendiente", "procesado", "fallido", "omitido"];
export const ESTADOS_VETERINARIO = ["pendiente", "aprobado", "rechazado"];
export const ESTADOS_CURACION = ["pendiente", "resuelto", "descartado"];
export const ESTADOS_TRANSFERENCIA = ["pendiente", "completada", "expirada", "cancelada"];
export const TIPOS_ACTOR_AUDITORIA = ["dueno", "veterinario", "municipalidad", "sistema"];
export const TIPOS_DOCUMENTO = ["DNI", "CE", "PASAPORTE"];
/** Quién inicia sesión: la misma separación de roles que usan los tokens. */
export const ROLES_SESION = ["dueno", "veterinario"];
/** Vigencia del código de verificación del correo y máximo de intentos por código. */
export const MINUTOS_VIGENCIA_CODIGO = 15;
export const INTENTOS_MAXIMOS_CODIGO = 5;
/** Máximo de vida del acceso de un validador tras escanear el QR (RN 10). */
export const HORAS_EXPIRACION_ACCESO_VALIDADOR = 4;
/** Vigencia del código de transferencia de dueño antes de expirar. */
export const HORAS_EXPIRACION_CODIGO_TRANSFERENCIA = 24;
/** Cuota diaria de adjuntos que se envían a OCR por dueño (sección 11: Textract es el costo variable más peligroso). */
export const CUOTA_OCR_DIARIA_POR_DUENO = 20;
/** Días de antelación con que se avisa un vencimiento de vacuna (incluye las ya vencidas). */
export const DIAS_VENTANA_RECORDATORIO_VACUNA = 30;
/** Cada cuántos meses se repite la desparasitación: no hay catálogo, se usa el intervalo habitual de una mascota adulta. */
export const MESES_VIGENCIA_DESPARASITACION = 3;
/** Retención mínima del log de auditoría en años (RN 9). */
export const ANIOS_RETENCION_AUDITORIA = 5;
/** TTL de la tabla de idempotencia en DynamoDB, en días. */
export const DIAS_TTL_IDEMPOTENCIA = 7;
