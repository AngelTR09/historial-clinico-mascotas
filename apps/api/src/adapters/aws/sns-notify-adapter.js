import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
/**
 * Implementación AWS de `NotifyPort`: publica en el tema SNS de recordatorios.
 * El error se propaga: quien notifica (el notificador, alimentado por SQS)
 * reintenta y, si agota los intentos, el mensaje queda en la DLQ (RNF 18).
 *
 * El mensaje es `{ template, to, data }`. Entregarlo al dueño (correo o SMS)
 * es trabajo de los suscriptores del tema, que hoy no existen. No se registra
 * `to` en ningún log (es un dato personal, RN 5).
 */
export class AdaptadorNotificacionSns {
    arnTema;
    cliente;
    constructor({ arnTema, cliente = new SNSClient({}) }) {
        this.arnTema = arnTema;
        this.cliente = cliente;
    }
    async notify(input) {
        await this.cliente.send(new PublishCommand({
            TopicArn: this.arnTema,
            Message: JSON.stringify({ template: input.template, to: input.to, data: input.data }),
            MessageAttributes: { template: { DataType: "String", StringValue: input.template } },
        }));
    }
}
