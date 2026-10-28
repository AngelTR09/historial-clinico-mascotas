const INTENTOS_POR_DEFECTO = 1;
/**
 * Cola en memoria con procesamiento diferido vía `setImmediate`, para que
 * el enqueue nunca bloquee la respuesta que lo dispara (RN 8). Se pierde
 * al reiniciar el proceso; en la nube la reemplaza SQS + DLQ.
 *
 * Emula también el comportamiento de SQS ante un fallo: un tema puede
 * reintentar su manejador hasta `maximoIntentosPorTema[topic]` veces y, si
 * se agotan, el mensaje queda en la cola de fallidos (la DLQ) en lugar de
 * perderse. Por defecto no se reintenta (un intento): reintentar solo es
 * seguro para manejadores idempotentes, y varios de los actuales no lo son
 * (p. ej. la carga masiva duplicaría mascotas).
 *
 * Extras solo locales, útiles en pruebas y scripts: `fallidos(topic)` y
 * `esperarVacia()`.
 */
export class AdaptadorColaEnMemoria {
    manejadores = new Map();
    colaFallidos = new Map();
    enCurso = new Set();
    maximoIntentosPorTema;
    constructor({ maximoIntentosPorTema = {} } = {}) {
        this.maximoIntentosPorTema = maximoIntentosPorTema;
    }
    enqueue(topic, payload) {
        const manejadoresDelTopico = this.manejadores.get(topic) ?? [];
        const maximoIntentos = this.maximoIntentosPorTema[topic] ?? INTENTOS_POR_DEFECTO;
        for (const manejador of manejadoresDelTopico) {
            const tarea = new Promise((resolver) => {
                setImmediate(async () => {
                    let ultimoError;
                    for (let intento = 1; intento <= maximoIntentos; intento++) {
                        try {
                            await manejador(payload);
                            resolver();
                            return;
                        }
                        catch (error) {
                            ultimoError = error;
                        }
                    }
                    this.fallidosDe(topic).push({ payload, error: ultimoError?.message ?? String(ultimoError), intentos: maximoIntentos });
                    // No se imprime el payload: puede traer datos personales (RN 5).
                    console.error(`[queue] "${topic}" fue a la DLQ tras ${maximoIntentos} intento(s):`, ultimoError?.message);
                    resolver();
                });
            });
            this.enCurso.add(tarea);
            tarea.finally(() => this.enCurso.delete(tarea));
        }
    }
    subscribe(topic, handler) {
        const manejadoresDelTopico = this.manejadores.get(topic) ?? [];
        manejadoresDelTopico.push(handler);
        this.manejadores.set(topic, manejadoresDelTopico);
    }
    /** Mensajes de `topic` que agotaron sus intentos (la DLQ). */
    fallidos(topic) {
        return [...this.fallidosDe(topic)];
    }
    /** Espera a que termine todo lo encolado, incluido lo que se encole mientras tanto. */
    async esperarVacia() {
        while (this.enCurso.size > 0) {
            await Promise.allSettled([...this.enCurso]);
        }
    }
    fallidosDe(topic) {
        if (!this.colaFallidos.has(topic)) {
            this.colaFallidos.set(topic, []);
        }
        return this.colaFallidos.get(topic);
    }
}
