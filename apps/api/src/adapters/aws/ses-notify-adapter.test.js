import { describe, expect, it } from "vitest";
import { AdaptadorNotificacionSes } from "./ses-notify-adapter.js";

describe("AdaptadorNotificacionSes (NotifyPort sobre SES)", () => {
    it("envía el correo con la plantilla del template, desde el remitente y al destinatario", async () => {
        const enviados = [];
        const adaptador = new AdaptadorNotificacionSes({ remitente: "no-responder@hcm.example", cliente: { send: async (comando) => void enviados.push(comando.input) } });
        await adaptador.notify({ to: "dueno@example.com", template: "codigo_verificacion", data: { codigo: "654321", minutosVigencia: 10 } });
        expect(enviados).toHaveLength(1);
        expect(enviados[0].FromEmailAddress).toBe("no-responder@hcm.example");
        expect(enviados[0].Destination.ToAddresses).toEqual(["dueno@example.com"]);
        expect(enviados[0].Content.Simple.Body.Text.Data).toContain("654321");
    });

    it("propaga el error de SES para que el reintento y la DLQ no dejen perder el recordatorio (RNF 18)", async () => {
        const adaptador = new AdaptadorNotificacionSes({ remitente: "a@b.c", cliente: { send: async () => { throw new Error("SES no responde"); } } });
        await expect(adaptador.notify({ to: "x@y.z", template: "recordatorio_vencimiento_vacuna", data: { nombreMascota: "Luna", vacuna: "Rabia", vencimiento: "2026-12-01" } })).rejects.toThrow("SES no responde");
    });

    it("una plantilla desconocida falla sin llamar a SES", async () => {
        let llamadas = 0;
        const adaptador = new AdaptadorNotificacionSes({ remitente: "a@b.c", cliente: { send: async () => void llamadas++ } });
        await expect(adaptador.notify({ to: "x@y.z", template: "no_existe", data: {} })).rejects.toThrow();
        expect(llamadas).toBe(0);
    });

    it("sin remitente no arranca: mejor fallar al ensamblar que al primer envío", () => {
        expect(() => new AdaptadorNotificacionSes({ remitente: "", cliente: {} })).toThrow(/CORREO_REMITENTE/);
    });
});
