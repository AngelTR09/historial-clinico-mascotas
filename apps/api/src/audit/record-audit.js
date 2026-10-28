import { hmacWithPepper } from "../crypto/symmetric.js";
import { db } from "../db/client.js";
import { registroAuditoria } from "../db/schema.js";
/**
 * RN 9: toda lectura y escritura sobre un expediente se audita. Un fallo
 * aquí nunca debe tumbar la operación de negocio que lo origina (igual
 * que el OCR de RN 8), así que solo se registra en el log de la app.
 */
export async function registrarAuditoria(input) {
    try {
        await db.insert(registroAuditoria).values({
            tipoActor: input.tipoActor,
            idActor: input.idActor,
            idMascota: input.idMascota,
            accion: input.accion,
            hashIp: hmacWithPepper(input.ip),
        });
    }
    catch (err) {
        console.error("No se pudo registrar la entrada de auditoría:", err);
    }
}
