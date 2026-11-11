import "../env.js";
import { construirPuertosLocales } from "../container.js";
import { TEMA_RECORDATORIO } from "../domain/temas-cola.js";
import { reencolarNormalizacionesPendientes } from "./normalization-sweep.js";
import { registrarTrabajadorNormalizador } from "./normalizer-worker.js";
import { registrarTrabajadorNotificador } from "./reminder-notifier-worker.js";
import { ejecutarBarridoRecordatorios } from "./reminders-worker.js";
const ports = construirPuertosLocales();
registrarTrabajadorNotificador(ports);
registrarTrabajadorNormalizador(ports);
const resultado = await ejecutarBarridoRecordatorios(ports);
// Igual que la Lambda diaria: rescata las vacunas que el normalizador nunca atendió.
const normalizacion = await reencolarNormalizacionesPendientes(ports);
await ports.cola.esperarVacia();
const enDlq = ports.cola.fallidos(TEMA_RECORDATORIO).length;
const entregados = resultado.encolados - enDlq;
console.log(`Recordatorios: ${resultado.encolados} encolados, ${entregados} entregados, ${enDlq} en la DLQ, ${resultado.fallidosAlEncolar} sin poder encolar, ${resultado.yaAvisados} ya avisados antes`);
console.log(`Vacunas sin normalizar: ${normalizacion.reencolados} reencoladas, ${normalizacion.fallidos} sin poder encolar`);
// Un recordatorio sin entregar es un fallo visible, no silencioso (RNF 18).
process.exit(enDlq > 0 || resultado.fallidosAlEncolar > 0 || normalizacion.fallidos > 0 ? 1 : 0);
