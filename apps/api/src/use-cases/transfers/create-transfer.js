import { HORAS_EXPIRACION_CODIGO_TRANSFERENCIA } from "@hcm/shared";
import { randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { hmacWithPepper } from "../../crypto/symmetric.js";
import { db } from "../../db/client.js";
import { mascotas, transferencias } from "../../db/schema.js";
import { esViolacionDeUnicidad } from "../../domain/db-errors.js";
import { ErrorConflicto, ErrorNoEncontrado } from "../../domain/errors.js";
function codigoTransferenciaAleatorio() {
    return randomBytes(5).toString("hex").toUpperCase();
}
/**
 * Inicia la cesión de una mascota a otro dueño (tabla `transfers`,
 * sección 6). El código en claro se devuelve una única vez, aquí; solo su
 * hash se persiste (mismo principio que `doc_hmac`, RN 4) y el dueño
 * entrante lo canjea aparte en `canjearTransferencia`.
 *
 * RNF 14: una mascota tiene a lo sumo una cesión pendiente (índice único parcial). Las
 * vencidas se marcan `expirada` antes de insertar para que no bloqueen una nueva; si ya
 * hay una vigente, hay que cancelarla primero. Las solicitudes simultáneas no pueden
 * dejar más de una: la base rechaza a las demás.
 */
export async function crearTransferencia(idDueno, input) {
    const [mascota] = await db.select({ idDueno: mascotas.idDueno }).from(mascotas).where(eq(mascotas.id, input.idMascota)).limit(1);
    if (!mascota) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    if (mascota.idDueno !== idDueno) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    const codigo = codigoTransferenciaAleatorio();
    const expiraEn = new Date(Date.now() + HORAS_EXPIRACION_CODIGO_TRANSFERENCIA * 60 * 60 * 1000);
    await db
        .update(transferencias)
        .set({ estado: "expirada" })
        .where(and(eq(transferencias.idMascota, input.idMascota), eq(transferencias.estado, "pendiente"), lt(transferencias.expiraEn, new Date())));
    let insertada;
    try {
        [insertada] = await db
            .insert(transferencias)
            .values({
            idMascota: input.idMascota,
            idDuenoOrigen: idDueno,
            hashCodigo: hmacWithPepper(codigo),
            expiraEn,
            estado: "pendiente",
        })
            .returning();
    }
    catch (error) {
        if (esViolacionDeUnicidad(error)) {
            throw new ErrorConflicto("Ya hay una transferencia pendiente para esta mascota; cancélala para crear otra");
        }
        throw error;
    }
    if (!insertada) {
        throw new Error("No se pudo crear la transferencia");
    }
    return {
        transferencia: {
            id: insertada.id,
            idMascota: insertada.idMascota,
            idDuenoOrigen: insertada.idDuenoOrigen,
            idDuenoDestino: insertada.idDuenoDestino,
            expiraEn: insertada.expiraEn.toISOString(),
            estado: insertada.estado,
        },
        codigo: codigo,
    };
}
