import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
export class ErrorColaNoConfigurada extends Error {
    constructor(topic) {
        super(`La cola "${topic}" no está configurada en este entorno`);
        this.name = "ErrorColaNoConfigurada";
    }
}
/**
 * Implementación AWS de `QueuePort`: SQS (con su DLQ, definida en Terraform).
 *
 * - `enqueue` no espera la respuesta de SQS: RN 8 pide que encolar nunca
 *   bloquee la escritura. Si SQS falla, se registra y la escritura sigue.
 *   Devuelve la promesa del envío para quien SÍ debe esperarla: una Lambda se congela
 *   al terminar y perdería el mensaje, y el barrido de recordatorios debe contar un
 *   envío fallido (RNF 18). Quien la ignora no recibe un rechazo sin manejar.
 * - `subscribe` no hace nada: en AWS los consumidores son Lambdas que reciben
 *   los mensajes de SQS, no el proceso de la API.
 * - Cuerpo del mensaje: `{ topic, payload }`, que es lo que la Lambda reenvía
 *   al mismo manejador que en local recibe `payload`.
 * - Un tema listado en `temasOmitidos` (p. ej. "ocr", diferido en el PMV) se
 *   descarta con una advertencia; cualquier otro sin cola lanza un error.
 */
export class AdaptadorColaSqs {
    urls;
    temasOmitidos;
    cliente;
    advertidos = new Set();
    constructor({ urls, temasOmitidos = [], cliente = new SQSClient({}) }) {
        this.urls = urls;
        this.temasOmitidos = new Set(temasOmitidos);
        this.cliente = cliente;
    }
    enqueue(topic, payload) {
        const url = this.urls[topic];
        if (!url) {
            if (this.temasOmitidos.has(topic)) {
                if (!this.advertidos.has(topic)) {
                    this.advertidos.add(topic);
                    console.warn(`[queue] el tema "${topic}" está diferido en este entorno: se descarta`);
                }
                return;
            }
            throw new ErrorColaNoConfigurada(topic);
        }
        const envio = this.cliente.send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify({ topic, payload }) })).then(() => undefined);
        envio.catch((error) => {
            console.error(`[queue] no se pudo encolar "${topic}":`, error.message);
        });
        return envio;
    }
    subscribe(_topic, _handler) {
        // Los consumidores son Lambdas disparadas por SQS (workers de la fase AWS).
    }
}
