/**
 * PuertoCola — contrato que debe cumplir cualquier adaptador de cola.
 * En local: cola en memoria con procesamiento diferido. En la nube: SQS + DLQ.
 *
 *   enqueue(topic, payload) -> void | Promise<void>
 *     La cola local devuelve void. La de SQS devuelve la promesa del envío, para que una
 *     Lambda (que se congela al terminar) o el barrido de recordatorios puedan esperarla.
 *   subscribe(topic, handler) -> void
 *     handler: (payload) => Promise<void>
 *     Si el manejador lanza, la cola reintenta y, agotados los intentos, el mensaje
 *     queda en la DLQ en vez de perderse. Por eso un manejador debe ser idempotente
 *     (SQS entrega al menos una vez).
 *
 * Solo el adaptador local añade `fallidos(topic)` y `esperarVacia()`, para pruebas.
 */
export {};
