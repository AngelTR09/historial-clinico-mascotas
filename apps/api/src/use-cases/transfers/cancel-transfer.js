import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { transferencias } from "../../db/schema.js";
import { ErrorConflicto, ErrorNoEncontrado } from "../../domain/errors.js";
/** Solo el dueño que inició la cesión puede arrepentirse mientras siga pendiente. */
export async function cancelarTransferencia(idDueno, idTransferencia) {
    const [transferencia] = await db.select().from(transferencias).where(eq(transferencias.id, idTransferencia)).limit(1);
    if (!transferencia) {
        throw new ErrorNoEncontrado("La transferencia no existe");
    }
    if (transferencia.idDuenoOrigen !== idDueno) {
        throw new ErrorNoEncontrado("La transferencia no existe");
    }
    if (transferencia.estado !== "pendiente") {
        throw new ErrorConflicto(`Esta transferencia ya está ${transferencia.estado}`);
    }
    const [actualizada] = await db
        .update(transferencias)
        .set({ estado: "cancelada" })
        .where(and(eq(transferencias.id, idTransferencia), eq(transferencias.estado, "pendiente")))
        .returning();
    if (!actualizada) {
        throw new ErrorConflicto("Esta transferencia ya cambió de estado");
    }
    return {
        id: actualizada.id,
        idMascota: actualizada.idMascota,
        idDuenoOrigen: actualizada.idDuenoOrigen,
        idDuenoDestino: actualizada.idDuenoDestino,
        expiraEn: actualizada.expiraEn.toISOString(),
        estado: actualizada.estado,
    };
}
