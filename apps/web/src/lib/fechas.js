/** Topes de los <input type="date">: la misma regla que el esquema compartido (no futura, no de hace más de 30 años). */
const aIso = (fecha) => fecha.toISOString().slice(0, 10);
export const HOY = aIso(new Date());
/** El veterinario solo registra atenciones de hoy o de la última semana. */
export const HACE_7_DIAS = aIso(new Date(Date.now() - 7 * 86_400_000));
export const HACE_30_ANIOS = aIso(new Date(Date.now() - 30 * 366 * 86_400_000));
