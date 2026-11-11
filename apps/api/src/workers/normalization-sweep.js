import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { db } from "../db/client.js";
import { eventosSalud, mascotas } from "../db/schema.js";
import { ejecutarEnLotes } from "../domain/en-lotes.js";
import { TEMA_NORMALIZADOR } from "../domain/temas-cola.js";

const ENVIOS_EN_PARALELO = 25;
// Un evento recién creado todavía tiene su mensaje en la cola: solo se rescata lo que lleva un rato sin atender.
const MINUTOS_DE_GRACIA = 15;
const MAXIMO_POR_BARRIDO = 2000;

/**
 * Rescata las vacunas que el normalizador nunca atendió. La API encola la normalización sin esperar a
 * la cola (RN 8: registrar no depende de SQS), así que si SQS rechazó ese mensaje la vacuna quedaría
 * para siempre sin vincular al catálogo y, sin `meses_vigencia`, nunca generaría un recordatorio
 * (RNF 15). El barrido diario vuelve a encolar las que siguen sin `normalized_at`.
 *
 * Repetirlo es seguro: el normalizador atiende cada evento una sola vez. Lo que no entra en un
 * barrido (`MAXIMO_POR_BARRIDO`) queda para el siguiente, empezando por lo más antiguo.
 */
export async function reencolarNormalizacionesPendientes(ports, { ahora = new Date(), minutosDeGracia = MINUTOS_DE_GRACIA, maximo = MAXIMO_POR_BARRIDO } = {}) {
    const limite = new Date(ahora.getTime() - minutosDeGracia * 60_000);
    const pendientes = await db
        .select({ idEvento: eventosSalud.id, textoOriginal: eventosSalud.textoOriginal, species: mascotas.especie })
        .from(eventosSalud)
        .innerJoin(mascotas, eq(mascotas.id, eventosSalud.idMascota))
        .where(and(eq(eventosSalud.tipo, "vacuna"), isNull(eventosSalud.normalizadoEn), lt(eventosSalud.creadoEn, limite)))
        .orderBy(asc(eventosSalud.creadoEn))
        .limit(maximo);
    let reencolados = 0;
    let fallidos = 0;
    const resultados = await ejecutarEnLotes(pendientes, ENVIOS_EN_PARALELO, async (trabajo) => ports.cola.enqueue(TEMA_NORMALIZADOR, trabajo));
    for (const resultado of resultados) {
        if (resultado.status === "fulfilled") {
            reencolados++;
        }
        else {
            fallidos++;
            console.error("[normalizador] no se pudo reencolar una vacuna pendiente:", resultado.reason?.message ?? resultado.reason);
        }
    }
    return { reencolados, fallidos };
}
