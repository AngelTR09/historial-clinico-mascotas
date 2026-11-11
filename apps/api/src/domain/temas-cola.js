/**
 * Un recordatorio de vacuna listo para entregar. El barrido diario lo encola y
 * el notificador lo entrega: separar "encolar" de "notificar" es lo que hace que
 * un recordatorio no se pierda cuando el servicio de notificaciones falla
 * (RNF 15 y 18). En SQS este tema es la cola `recordatorios` con su DLQ.
 */
export const TEMA_RECORDATORIO = "reminder";
// Mismo valor que `maxReceiveCount` de la cola SQS en Terraform.
export const INTENTOS_RECORDATORIO = 3;

/**
 * Pide reconstruir la ficha pública de una mascota (`{ idMascota }`). Lo encolan los casos de
 * uso que cambian lo que la ficha muestra y lo consume el proyector, que escribe el perfil en
 * el modelo de lectura (DynamoDB). En SQS es la cola `proyeccion` con su DLQ.
 */
export const TEMA_PROYECTOR = "projector";

/**
 * Pide vincular el texto libre de una vacuna con el catálogo (`{ idEvento, textoOriginal, species }`).
 * Lo encola el registro de un evento y lo vuelve a encolar el barrido diario si nadie lo atendió.
 * En SQS es la cola `normalizacion` con su DLQ.
 */
export const TEMA_NORMALIZADOR = "normalizer";
