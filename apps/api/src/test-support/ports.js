/**
 * Puertos mínimos para probar casos de uso que solo encolan: anota cada mensaje en vez de enviarlo.
 * Los que necesitan una cola real (workers de punta a punta) usan `AdaptadorColaEnMemoria`.
 */
export function crearPuertosDePrueba() {
    const encolados = [];
    const ports = {
        cola: {
            enqueue: (topic, payload) => {
                encolados.push({ topic, payload });
            },
            subscribe: () => { },
        },
    };
    return { ports, encolados };
}
