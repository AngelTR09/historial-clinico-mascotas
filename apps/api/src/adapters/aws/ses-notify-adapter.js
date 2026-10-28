import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { renderizarCorreo } from "../../domain/plantillas-correo.js";

/**
 * Implementación AWS de `NotifyPort`: envía el correo por SES. Es lo que hace llegar al dueño el
 * código de 6 dígitos del inicio de sesión y los recordatorios de vacunas, que hasta ahora solo
 * llegaban a un tema SNS sin suscriptores.
 *
 * El error se propaga: quien notifica un recordatorio (el notificador, alimentado por SQS)
 * reintenta y, si agota los intentos, el mensaje queda en la DLQ (RNF 18). Nunca se registra
 * `to` ni el cuerpo: son datos personales (RN 5).
 *
 * Con la cuenta de SES en sandbox, el remitente y cada destinatario deben estar verificados.
 */
export class AdaptadorNotificacionSes {
    remitente;
    cliente;
    constructor({ remitente, cliente = new SESv2Client({}) }) {
        if (!remitente) {
            throw new Error("AdaptadorNotificacionSes necesita el correo remitente (CORREO_REMITENTE)");
        }
        this.remitente = remitente;
        this.cliente = cliente;
    }
    async notify(input) {
        const { asunto, cuerpo } = renderizarCorreo(input.template, input.data);
        await this.cliente.send(new SendEmailCommand({
            FromEmailAddress: this.remitente,
            Destination: { ToAddresses: [input.to] },
            Content: { Simple: { Subject: { Data: asunto, Charset: "UTF-8" }, Body: { Text: { Data: cuerpo, Charset: "UTF-8" } } } },
        }));
    }
}
