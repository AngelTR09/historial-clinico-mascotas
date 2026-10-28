/**
 * Adapta un worker escrito contra `QueuePort` (`ports.cola.subscribe(tema, manejador)`) a una Lambda
 * alimentada por SQS. El cuerpo del worker no cambia: en local lo invoca la cola en memoria y en AWS
 * lo invoca este manejador, con el `{ topic, payload }` que dejó `AdaptadorColaSqs`.
 *
 * Reporta fallos por mensaje (`batchItemFailures`, con `ReportBatchItemFailures` en la fuente de
 * eventos): SQS reintenta solo los que fallaron y, tras `maxReceiveCount`, los manda a su DLQ
 * (RNF 18). Lanzar por todo el lote reintentaría también los mensajes que ya se procesaron.
 */
export function crearManejadorSqs({ registrar, puertos }) {
    const manejadores = new Map();
    const colaDeLaFuncion = {
        // Una Lambda se congela al terminar: lo que el worker encole debe esperarse.
        enqueue: (tema, payload) => puertos.cola.enqueue(tema, payload),
        subscribe: (tema, manejador) => manejadores.set(tema, manejador),
    };
    registrar({ ...puertos, cola: colaDeLaFuncion });

    return async (evento) => {
        const batchItemFailures = [];
        for (const registro of evento.Records ?? []) {
            try {
                const { topic, payload } = JSON.parse(registro.body);
                const manejador = manejadores.get(topic);
                if (!manejador) {
                    throw new Error(`Esta función no atiende el tema "${topic}"`);
                }
                await manejador(payload);
            }
            catch (error) {
                // No se imprime el cuerpo: puede traer datos personales (RN 5).
                console.error(`[lambda] falló el mensaje ${registro.messageId}:`, error.message);
                batchItemFailures.push({ itemIdentifier: registro.messageId });
            }
        }
        return { batchItemFailures };
    };
}
