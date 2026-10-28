import { prepararEntornoTrabajador } from "./arranque.js";

/**
 * Lambda `recordatorios` (EventBridge, una vez al día): busca las vacunas vencidas o por vencer y
 * encola un mensaje por recordatorio. NO notifica: entrega el `notificador`, para que un fallo del
 * correo no corte el barrido (RNF 15 y 18). Si algún envío a la cola falla, la función falla: así
 * queda en su DLQ y en las alarmas en vez de perder el recordatorio en silencio.
 */
export async function handler() {
    await prepararEntornoTrabajador();
    const { config } = await import("../config.js");
    const { AdaptadorColaSqs } = await import("../adapters/aws/sqs-queue-adapter.js");
    const { ejecutarBarridoRecordatorios } = await import("../workers/reminders-worker.js");
    const cola = new AdaptadorColaSqs({ urls: { reminder: config.URL_COLA_RECORDATORIOS } });
    const resultado = await ejecutarBarridoRecordatorios({ cola });
    console.log("[recordatorios] barrido terminado:", resultado);
    if (resultado.fallidosAlEncolar > 0) {
        throw new Error(`${resultado.fallidosAlEncolar} recordatorio(s) no se pudieron encolar`);
    }
    return resultado;
}
