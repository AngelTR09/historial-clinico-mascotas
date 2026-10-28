import { describe, expect, it } from "vitest";
import { leerSecretoJson } from "./secrets-manager-reader.js";

describe("leerSecretoJson", () => {
    it("pide el secreto por su ARN y devuelve el JSON ya interpretado", async () => {
        const pedidos = [];
        const cliente = { send: async (comando) => (pedidos.push(comando.input), { SecretString: '{"username":"hcm_admin","password":"p@ss"}' }) };
        expect(await leerSecretoJson("arn:aws:secretsmanager:us-east-1:1:secret:rds", cliente)).toEqual({ username: "hcm_admin", password: "p@ss" });
        expect(pedidos).toEqual([{ SecretId: "arn:aws:secretsmanager:us-east-1:1:secret:rds" }]);
    });

    it("falla si el secreto no trae texto (por ejemplo, uno binario)", async () => {
        await expect(leerSecretoJson("arn", { send: async () => ({}) })).rejects.toThrow(/valor de texto/);
    });
});
