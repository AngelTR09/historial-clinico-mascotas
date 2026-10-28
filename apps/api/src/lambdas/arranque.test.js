import { describe, expect, it } from "vitest";
import { prepararEntornoTrabajador } from "./arranque.js";

describe("prepararEntornoTrabajador", () => {
    it("trae las credenciales de RDS del secreto y marca el proceso como trabajador", async () => {
        const entorno = { ARN_SECRETO_BD: "arn:secreto" };
        await prepararEntornoTrabajador({ entorno, leerSecreto: async (arn) => (arn === "arn:secreto" ? { username: "hcm_admin", password: "clave" } : null) });
        expect(entorno).toMatchObject({ PROCESO: "trabajador", DB_USER: "hcm_admin", DB_PASSWORD: "clave" });
    });

    it("una función sin base de datos (el notificador) no llama a Secrets Manager", async () => {
        const entorno = {};
        await prepararEntornoTrabajador({ entorno, leerSecreto: async () => { throw new Error("no debe llamarse"); } });
        expect(entorno).toEqual({ PROCESO: "trabajador" });
    });

    it("si el secreto no se puede leer, el arranque falla: mejor un error claro que conectar sin contraseña", async () => {
        await expect(prepararEntornoTrabajador({ entorno: { ARN_SECRETO_BD: "arn" }, leerSecreto: async () => { throw new Error("sin permiso"); } })).rejects.toThrow("sin permiso");
    });
});
