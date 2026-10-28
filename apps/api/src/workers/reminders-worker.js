import { TEMA_RECORDATORIO } from "../domain/temas-cola.js";
import { buscarRecordatoriosVencidos } from "../use-cases/reminders/find-due-reminders.js";
import { ejecutarEnLotes } from "../domain/en-lotes.js";
const ENVIOS_EN_PARALELO = 25;
/**
 * Barrido de recordatorios de vencimiento de vacunas y desparasitaciones (workers/reminders,
 * sección 5). En la nube lo dispara EventBridge con una Lambda; en local
 * no hay scheduler, así que se invoca a mano o vía cron del sistema con
 * `pnpm reminders:run` (ver run-reminders-once.js). No lleva estado de
 * "ya se avisó": cada corrida vuelve a avisar lo que siga vencido o por
 * vencer, igual que perdería un cron real que se salta una ejecución.
 *
 * El barrido NO notifica: encola cada recordatorio y el notificador
 * (`reminder-notifier-worker.js`) lo entrega. Así un fallo al entregar uno
 * no corta el barrido ni pierde a los demás (RNF 15 y 18). Si encolar uno
 * falla, se cuenta y se sigue con el resto.
 */
export async function ejecutarBarridoRecordatorios(ports, fechaReferencia = new Date()) {
    const vencidos = await buscarRecordatoriosVencidos(fechaReferencia);
    let encolados = 0;
    let fallidosAlEncolar = 0;
    const resultados = await ejecutarEnLotes(vencidos, ENVIOS_EN_PARALELO, async (recordatorio) => ports.cola.enqueue(TEMA_RECORDATORIO, {
        to: recordatorio.ownerEmail,
        nombreMascota: recordatorio.nombreMascota,
        vacuna: recordatorio.nombreCanonico,
        tipo: recordatorio.tipo,
        vencimiento: recordatorio.dueDate.toISOString().slice(0, 10),
    }));
    for (const resultado of resultados) {
        if (resultado.status === "fulfilled") {
            encolados++;
        }
        else {
            fallidosAlEncolar++;
            console.error("[reminders] no se pudo encolar un recordatorio:", resultado.reason?.message ?? resultado.reason);
        }
    }
    return { encolados, fallidosAlEncolar };
}
