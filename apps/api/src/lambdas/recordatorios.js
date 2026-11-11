import { prepararEntornoTrabajador } from "./arranque.js";

/**
 * Lambda `recordatorios` (EventBridge, una vez al día). Hace dos barridos:
 *  1. Busca las vacunas y desparasitaciones vencidas o por vencer y encola un mensaje por recordatorio
 *     que todavía no se haya despachado. NO notifica: entrega el `notificador`, para que un fallo del
 *     correo no corte el barrido (RNF 15 y 18).
 *  2. Vuelve a encolar las vacunas que el normalizador nunca atendió (su mensaje se perdió).
 * Si algún envío a una cola falla, la función falla: así queda en su DLQ y en las alarmas en vez de
 * perderse en silencio. El segundo barrido corre aunque el primero haya tenido fallos.
 */
export async function handler() {
    await prepararEntornoTrabajador();
    const { config } = await import("../config.js");
    const { AdaptadorColaSqs } = await import("../adapters/aws/sqs-queue-adapter.js");
    const { ejecutarBarridoRecordatorios } = await import("../workers/reminders-worker.js");
    const { reencolarNormalizacionesPendientes } = await import("../workers/normalization-sweep.js");
    const cola = new AdaptadorColaSqs({ urls: { reminder: config.URL_COLA_RECORDATORIOS, normalizer: config.URL_COLA_NORMALIZACION } });
    const recordatorios = await ejecutarBarridoRecordatorios({ cola });
    console.log("[recordatorios] barrido terminado:", recordatorios);
    const normalizacion = await reencolarNormalizacionesPendientes({ cola });
    console.log("[recordatorios] vacunas sin normalizar reencoladas:", normalizacion);
    const sinEncolar = recordatorios.fallidosAlEncolar + normalizacion.fallidos;
    if (sinEncolar > 0) {
        throw new Error(`${sinEncolar} mensaje(s) no se pudieron encolar`);
    }
    return { ...recordatorios, normalizacion };
}
