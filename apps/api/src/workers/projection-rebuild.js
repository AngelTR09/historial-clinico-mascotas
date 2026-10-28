import { asc, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { mascotas } from "../db/schema.js";
import { ejecutarEnLotes } from "../domain/en-lotes.js";
import { TEMA_PROYECTOR } from "../domain/temas-cola.js";

const ENVIOS_EN_PARALELO = 25;

/**
 * Recarga la proyección de la ficha pública de las mascotas que ya existían antes del proyector:
 * hasta ahora solo se proyectaba al cambiar una mascota, así que en DynamoDB faltaban todas las
 * demás y su QR respondía "no existe". No proyecta aquí: encola un mensaje por mascota y lo
 * procesa el proyector de siempre, con su concurrencia acotada para no saturar a RDS.
 *
 * Recorre por `id` en páginas, así que se puede interrumpir y seguir: devuelve `siguiente` (el
 * último id encolado, o `null` si terminó) para pasarlo como `despues` en la siguiente llamada.
 * Se detiene al llegar a `maximoPaginas` (una Lambda tiene tiempo limitado). Repetirlo es seguro:
 * el proyector es idempotente.
 */
export async function reconstruirProyecciones(ports, { despues = null, tamanoPagina = 500, maximoPaginas = Infinity } = {}) {
    let cursor = despues;
    let encolados = 0;
    let fallidos = 0;
    for (let pagina = 0; pagina < maximoPaginas; pagina++) {
        const filas = await db
            .select({ id: mascotas.id })
            .from(mascotas)
            .where(cursor ? gt(mascotas.id, cursor) : undefined)
            .orderBy(asc(mascotas.id))
            .limit(tamanoPagina);
        if (filas.length === 0) {
            return { encolados, fallidos, siguiente: null };
        }
        const resultados = await ejecutarEnLotes(filas, ENVIOS_EN_PARALELO, async ({ id }) => ports.cola.enqueue(TEMA_PROYECTOR, { idMascota: id }));
        for (const resultado of resultados) {
            if (resultado.status === "fulfilled") {
                encolados++;
            }
            else {
                fallidos++;
                console.error("[proyeccion] no se pudo encolar una mascota:", resultado.reason?.message ?? resultado.reason);
            }
        }
        cursor = filas[filas.length - 1].id;
    }
    return { encolados, fallidos, siguiente: cursor };
}

const MARGEN_TIEMPO_MS = 15_000;

/**
 * Lo mismo, pero repartido en una Lambda: sigue página a página mientras `milisegundosRestantes()`
 * supere el margen y devuelve `siguiente` para que quien la invoca la vuelva a llamar con él como
 * `despues` hasta que sea `null`.
 */
export async function reconstruirProyeccionesDentroDelTiempo(ports, { despues = null, milisegundosRestantes, margenMs = MARGEN_TIEMPO_MS, tamanoPagina }) {
    const total = { encolados: 0, fallidos: 0, siguiente: despues };
    do {
        const parcial = await reconstruirProyecciones(ports, { despues: total.siguiente, maximoPaginas: 1, tamanoPagina });
        total.encolados += parcial.encolados;
        total.fallidos += parcial.fallidos;
        total.siguiente = parcial.siguiente;
    } while (total.siguiente && milisegundosRestantes() > margenMs);
    return total;
}
