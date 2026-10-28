import { and, eq } from "drizzle-orm";
import { hmacWithPepper } from "../../crypto/symmetric.js";
import { db } from "../../db/client.js";
import { mascotas, transferencias } from "../../db/schema.js";
import { ErrorConflicto, ErrorProhibido, ErrorNoEncontrado } from "../../domain/errors.js";
/**
 * Canjea el código de una sola vez: mueve `mascotas.owner_id` al dueño
 * entrante y cierra la transferencia, ambos en una sola transacción para
 * no dejar la mascota "a medio ceder" si algo falla a mitad (mismo
 * principio que la alta de camada, sección 12). El `where estado =
 * 'pendiente'` dentro de la transacción evita que dos canjes concurrentes
 * del mismo código muevan la mascota dos veces.
 */
export async function canjearTransferencia(idDuenoNuevo, input) {
    const [transferencia] = await db.select().from(transferencias).where(eq(transferencias.id, input.idTransferencia)).limit(1);
    if (!transferencia) {
        throw new ErrorNoEncontrado("El código de transferencia no existe");
    }
    if (transferencia.idDuenoOrigen === idDuenoNuevo) {
        throw new ErrorProhibido("No puedes canjear tu propia transferencia");
    }
    if (transferencia.estado !== "pendiente") {
        throw new ErrorConflicto(`Esta transferencia ya está ${transferencia.estado}`);
    }
    if (transferencia.expiraEn.getTime() < Date.now()) {
        await db.update(transferencias).set({ estado: "expirada" }).where(eq(transferencias.id, transferencia.id));
        throw new ErrorConflicto("El código de transferencia expiró");
    }
    if (transferencia.hashCodigo !== hmacWithPepper(input.codigo)) {
        throw new ErrorProhibido("Código de transferencia incorrecto");
    }
    const actualizada = await db.transaction(async (tx) => {
        const [transferenciaActualizada] = await tx
            .update(transferencias)
            .set({ idDuenoDestino: idDuenoNuevo, estado: "completada", completadaEn: new Date() })
            .where(and(eq(transferencias.id, transferencia.id), eq(transferencias.estado, "pendiente")))
            .returning();
        if (!transferenciaActualizada) {
            throw new ErrorConflicto("Esta transferencia ya fue canjeada");
        }
        // La mascota solo se mueve si sigue siendo del dueño que inició la cesión. Si no, se lanza
        // y la transacción entera se revierte: la transferencia vuelve a pendiente y nada cambia.
        const [movida] = await tx
            .update(mascotas)
            .set({ idDueno: idDuenoNuevo })
            .where(and(eq(mascotas.id, transferencia.idMascota), eq(mascotas.idDueno, transferencia.idDuenoOrigen)))
            .returning({ id: mascotas.id });
        if (!movida) {
            throw new ErrorConflicto("La mascota ya no pertenece a quien inició la transferencia");
        }
        return transferenciaActualizada;
    });
    return {
        id: actualizada.id,
        idMascota: actualizada.idMascota,
        idDuenoOrigen: actualizada.idDuenoOrigen,
        idDuenoDestino: actualizada.idDuenoDestino,
        expiraEn: actualizada.expiraEn.toISOString(),
        estado: actualizada.estado,
    };
}
