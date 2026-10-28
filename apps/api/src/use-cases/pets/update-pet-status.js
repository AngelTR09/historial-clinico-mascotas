import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { mascotas } from "../../db/schema.js";
import { ErrorNoEncontrado } from "../../domain/errors.js";
import { solicitarProyeccionPerfilPublico } from "../public/request-public-profile-projection.js";
import { mascotaParaDueno } from "./pet-mapper.js";
/** Fecha de hoy (solo fecha) en la zona horaria del país: de noche, UTC ya sería "mañana". */
function fechaHoyEnLima() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}
/**
 * Reporta una mascota como extraviada, recuperada (`activa`) o fallecida.
 * Es lo único que hace real el `estaExtraviada` de la ficha pública (RF 21): antes
 * de esto, `mascotas.estado` nunca podía salir de `activa` después del alta.
 * Al pasar a `extraviada` fija `extraviadaDesde` (solo fecha, sin lugar) y la
 * conserva si ya estaba extraviada; con cualquier otro estado la limpia.
 */
export async function actualizarEstadoMascota(ports, idDueno, idMascota, input) {
    const [existente] = await db.select().from(mascotas).where(eq(mascotas.id, idMascota)).limit(1);
    if (!existente) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    if (existente.idDueno !== idDueno) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    const extraviadaDesde = input.estado === "extraviada" ? (existente.estado === "extraviada" && existente.extraviadaDesde) || fechaHoyEnLima() : null;
    const [actualizada] = await db.update(mascotas).set({ estado: input.estado, extraviadaDesde }).where(eq(mascotas.id, idMascota)).returning();
    if (!actualizada) {
        throw new Error("No se pudo actualizar el estado de la mascota");
    }
    solicitarProyeccionPerfilPublico(ports, idMascota);
    return mascotaParaDueno(actualizada);
}
