import { describe, expect, it } from "vitest";
import { AdaptadorProyeccionDynamoDb } from "./dynamodb-projection-adapter.js";

describe("AdaptadorProyeccionDynamoDb (ProjectionPort sobre DynamoDB)", () => {
    it("escribe { qr_token, perfil, actualizado_en } con el token como clave", async () => {
        const enviados = [];
        const adaptador = new AdaptadorProyeccionDynamoDb({ tabla: "hcm-public-profile", cliente: { send: async (comando) => void enviados.push(comando.input) } });
        await adaptador.guardarPerfil("tok123", { tokenQr: "tok123", nombreMascota: "Luna", claveFoto: null });
        expect(enviados).toHaveLength(1);
        expect(enviados[0].TableName).toBe("hcm-public-profile");
        expect(enviados[0].Item.qr_token).toBe("tok123");
        expect(enviados[0].Item.perfil).toEqual({ tokenQr: "tok123", nombreMascota: "Luna", claveFoto: null });
        expect(Number.isNaN(Date.parse(enviados[0].Item.actualizado_en))).toBe(false);
    });

    it("propaga el error para que SQS reintente y, si se agota, el mensaje vaya a la DLQ", async () => {
        const adaptador = new AdaptadorProyeccionDynamoDb({ tabla: "t", cliente: { send: async () => { throw new Error("DynamoDB no responde"); } } });
        await expect(adaptador.guardarPerfil("t", {})).rejects.toThrow("DynamoDB no responde");
    });
});
