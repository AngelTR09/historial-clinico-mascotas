import "../env.js";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../db/client.js";
import { registroAuditoria } from "../db/schema.js";
import { registrarAuditoria } from "./record-audit.js";
describe("registrarAuditoria", () => {
    it("inserta una fila con el actor, la acción y un hash de IP, nunca la IP en claro", async () => {
        const accion = `test_accion_${crypto.randomUUID()}`;
        await registrarAuditoria({ tipoActor: "dueno", idActor: null, idMascota: null, accion, ip: "203.0.113.7" });
        const [fila] = await db.select().from(registroAuditoria).where(eq(registroAuditoria.accion, accion)).limit(1);
        expect(fila).toBeDefined();
        expect(fila?.tipoActor).toBe("dueno");
        expect(fila?.hashIp).not.toBe("203.0.113.7");
        expect(fila?.hashIp).toMatch(/^[0-9a-f]{64}$/);
        if (fila) {
            await db.delete(registroAuditoria).where(eq(registroAuditoria.id, fila.id));
        }
    });
    it("no lanza si la escritura de auditoría falla (RN 8/9: nunca bloquea la operación de negocio)", async () => {
        await expect(registrarAuditoria({ tipoActor: "dueno", idActor: null, idMascota: "no-es-un-uuid", accion: "test_fallo", ip: "203.0.113.7" })).resolves.toBeUndefined();
    });
});
