/**
 * Ejecuta `tarea` sobre cada elemento en lotes de `tamano` en paralelo y devuelve el resultado de
 * cada uno (`Promise.allSettled`). Esperarlos uno por uno agotaría el tiempo de una Lambda con
 * miles de elementos, y soltarlos todos a la vez saturaría al cliente de SQS.
 */
export async function ejecutarEnLotes(elementos, tamano, tarea) {
    const resultados = [];
    for (let desde = 0; desde < elementos.length; desde += tamano) {
        const lote = elementos.slice(desde, desde + tamano);
        resultados.push(...(await Promise.allSettled(lote.map(async (elemento) => tarea(elemento)))));
    }
    return resultados;
}
