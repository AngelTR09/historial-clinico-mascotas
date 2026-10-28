import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { mascotas } from "../../db/schema.js";
import { ErrorNoEncontrado } from "../../domain/errors.js";
import { solicitarProyeccionPerfilPublico } from "../public/request-public-profile-projection.js";
import { mascotaParaDueno } from "./pet-mapper.js";
const CAMPOS_EDITABLES = ["colorSenas", "esterilizada", "alertasMedicas", "alertasMedicasPublicas", "temperamento", "notaDelDueno"];
/**
 * El dueño edita los datos de identificación y cuidado que se muestran en la
 * ficha pública. `input` ya pasó por `esquemaActualizacionMascota`: los campos
 * ausentes (`undefined`) no se tocan y `null` borra el dato.
 * Las alertas médicas siguen sin publicarse mientras `alertasMedicasPublicas`
 * sea false (lo aplica el adaptador de lectura pública).
 */
export async function actualizarMascota(ports, idDueno, idMascota, input) {
    const [existente] = await db.select().from(mascotas).where(eq(mascotas.id, idMascota)).limit(1);
    if (!existente) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    if (existente.idDueno !== idDueno) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    const cambios = {};
    for (const campo of CAMPOS_EDITABLES) {
        if (input[campo] !== undefined) {
            cambios[campo] = input[campo];
        }
    }
    if (Object.keys(cambios).length === 0) {
        return mascotaParaDueno(existente);
    }
    const [actualizada] = await db.update(mascotas).set(cambios).where(eq(mascotas.id, idMascota)).returning();
    if (!actualizada) {
        throw new Error("No se pudo actualizar la mascota");
    }
    solicitarProyeccionPerfilPublico(ports, idMascota);
    return mascotaParaDueno(actualizada);
}
