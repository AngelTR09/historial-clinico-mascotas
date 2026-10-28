import { describe, expect, it } from "vitest";
import { AdaptadorNotificacionSns } from "./sns-notify-adapter.js";

describe("AdaptadorNotificacionSns (NotifyPort sobre SNS)", () => {
    it("publica { template, to, data } en el tema con el template como atributo", async () => {
        const enviados = [];
        const adaptador = new AdaptadorNotificacionSns({
            arnTema: "arn:aws:sns:us-east-1:123456789012:hcm-recordatorios",
            cliente: { send: async (comando) => void enviados.push(comando.input) },
        });
        await adaptador.notify({ to: "dueno@example.com", template: "recordatorio_vencimiento_vacuna", data: { nombreMascota: "Luna" } });
        expect(enviados).toHaveLength(1);
        expect(enviados[0].TopicArn).toBe("arn:aws:sns:us-east-1:123456789012:hcm-recordatorios");
        expect(JSON.parse(enviados[0].Message)).toEqual({
            template: "recordatorio_vencimiento_vacuna",
            to: "dueno@example.com",
            data: { nombreMascota: "Luna" },
        });
        expect(enviados[0].MessageAttributes.template.StringValue).toBe("recordatorio_vencimiento_vacuna");
    });

    it("propaga el error para que el reintento y la DLQ de SQS no dejen perder el recordatorio (RNF 18)", async () => {
        const adaptador = new AdaptadorNotificacionSns({
            arnTema: "arn:aws:sns:us-east-1:123456789012:t",
            cliente: { send: async () => { throw new Error("SNS no responde"); } },
        });
        await expect(adaptador.notify({ to: "a@b.c", template: "x", data: {} })).rejects.toThrow("SNS no responde");
    });
});
