import { inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { recordatoriosDespachados } from "../db/schema.js";
import { ejecutarEnLotes } from "../domain/en-lotes.js";
import { TEMA_RECORDATORIO } from "../domain/temas-cola.js";
import { buscarRecordatoriosVencidos } from "../use-cases/reminders/find-due-reminders.js";
const ENVIOS_EN_PARALELO = 25;
const MARCAS_POR_CONSULTA = 1000;

function aFechaIso(fecha) {
    // Fecha local, igual que `sumarMeses` al calcular el vencimiento: evita correrla un día por la zona horaria.
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** `por_vencer` mientras falte para la fecha; `vencido` desde el día del vencimiento. */
function etapaDe(recordatorio, fechaReferencia) {
    return aFechaIso(recordatorio.dueDate) <= aFechaIso(fechaReferencia) ? "vencido" : "por_vencer";
}

function claveDe(idMascota, concepto, venceEn, etapa) {
    return `${idMascota}|${concepto}|${venceEn}|${etapa}`;
}

/** Claves de los avisos de estas mascotas que ya se despacharon en un barrido anterior. */
async function clavesYaDespachadas(idsMascota) {
    const claves = new Set();
    for (let inicio = 0; inicio < idsMascota.length; inicio += MARCAS_POR_CONSULTA) {
        const filas = await db
            .select()
            .from(recordatoriosDespachados)
            .where(inArray(recordatoriosDespachados.idMascota, idsMascota.slice(inicio, inicio + MARCAS_POR_CONSULTA)));
        for (const fila of filas) {
            claves.add(claveDe(fila.idMascota, fila.concepto, fila.venceEn, fila.etapa));
        }
    }
    return claves;
}

/**
 * Barrido de recordatorios de vencimiento de vacunas y desparasitaciones. En la nube lo dispara
 * EventBridge con la Lambda `recordatorios`; en local se invoca con `pnpm reminders:run`.
 *
 * El barrido NO notifica: encola cada recordatorio y el notificador (`reminder-notifier-worker.js`) lo
 * entrega. Así un fallo al entregar uno no corta el barrido ni pierde a los demás (RNF 15 y 18).
 *
 * Cada vencimiento se avisa a lo sumo dos veces: al entrar en la ventana (`por_vencer`) y cuando ya
 * venció (`vencido`). Lo que se encola queda anotado en `reminder_dispatches` (el "marca enviados" del
 * diagrama) y los barridos siguientes lo saltan: el dueño no recibe el mismo correo todos los días.
 *
 * Orden que protege el RNF 18: primero se encola y después se anota. Si el proceso muere entre los
 * dos pasos, el siguiente barrido repite ese aviso (un duplicado), pero ninguno se pierde. Anotar
 * primero perdería el recordatorio si la cola fallara después. Si encolar uno falla, no se anota: se
 * cuenta y el siguiente barrido lo reintenta.
 */
export async function ejecutarBarridoRecordatorios(ports, fechaReferencia = new Date()) {
    const vencidos = await buscarRecordatoriosVencidos(fechaReferencia);
    const yaDespachadas = await clavesYaDespachadas([...new Set(vencidos.map((recordatorio) => recordatorio.idMascota))]);
    const pendientes = [];
    for (const recordatorio of vencidos) {
        const venceEn = aFechaIso(recordatorio.dueDate);
        const etapa = etapaDe(recordatorio, fechaReferencia);
        if (!yaDespachadas.has(claveDe(recordatorio.idMascota, recordatorio.concepto, venceEn, etapa))) {
            pendientes.push({ recordatorio, venceEn, etapa });
        }
    }
    let encolados = 0;
    let fallidosAlEncolar = 0;
    const resultados = await ejecutarEnLotes(pendientes, ENVIOS_EN_PARALELO, async ({ recordatorio, venceEn, etapa }) => {
        await ports.cola.enqueue(TEMA_RECORDATORIO, {
            to: recordatorio.ownerEmail,
            nombreMascota: recordatorio.nombreMascota,
            vacuna: recordatorio.nombreCanonico,
            tipo: recordatorio.tipo,
            vencimiento: venceEn,
            etapa,
        });
        try {
            await db
                .insert(recordatoriosDespachados)
                .values({ idMascota: recordatorio.idMascota, concepto: recordatorio.concepto, venceEn, etapa })
                .onConflictDoNothing();
        }
        catch (error) {
            // Ya está en la cola: se entregará. Sin la marca, el próximo barrido lo repite una vez.
            console.error("[reminders] recordatorio encolado pero sin anotar; puede repetirse:", error.message);
        }
    });
    for (const resultado of resultados) {
        if (resultado.status === "fulfilled") {
            encolados++;
        }
        else {
            fallidosAlEncolar++;
            console.error("[reminders] no se pudo encolar un recordatorio:", resultado.reason?.message ?? resultado.reason);
        }
    }
    return { encolados, fallidosAlEncolar, yaAvisados: vencidos.length - pendientes.length };
}
