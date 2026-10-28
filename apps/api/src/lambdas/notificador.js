import { crearManejadorSqs } from "./lambda-sqs.js";

/**
 * Lambda `notificador` (SQS `recordatorios`): entrega cada recordatorio por correo (SES). Si SES
 * falla, el mensaje vuelve a la cola y, tras 3 intentos, queda en su DLQ (RNF 18).
 * Corre fuera de la VPC y sin base de datos, así que no importa `config.js` (que exige DB_*) y
 * lee su único valor directo del entorno.
 */
let manejador;

async function construir() {
    const { AdaptadorNotificacionSes } = await import("../adapters/aws/ses-notify-adapter.js");
    const { registrarTrabajadorNotificador } = await import("../workers/reminder-notifier-worker.js");
    return crearManejadorSqs({
        registrar: registrarTrabajadorNotificador,
        puertos: { notificacion: new AdaptadorNotificacionSes({ remitente: process.env.CORREO_REMITENTE }) },
    });
}

export async function handler(evento) {
    manejador ??= await construir();
    return manejador(evento);
}
