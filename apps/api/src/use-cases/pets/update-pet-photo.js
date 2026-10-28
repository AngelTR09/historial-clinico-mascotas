import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { mascotas } from "../../db/schema.js";
import { ErrorNoEncontrado, ErrorSolicitudInvalida } from "../../domain/errors.js";
import { solicitarProyeccionPerfilPublico } from "../public/request-public-profile-projection.js";
import { mascotaParaDueno } from "./pet-mapper.js";
const EXTENSION_POR_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
async function obtenerMascotaDelDueno(idDueno, idMascota) {
    const [existente] = await db.select().from(mascotas).where(eq(mascotas.id, idMascota)).limit(1);
    if (!existente) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    if (existente.idDueno !== idDueno) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    return existente;
}
/** Vista de la mascota para su dueño, con la URL temporal de lectura de su foto si la tiene. */
export async function mascotaParaDuenoConFoto(ports, fila) {
    const mascota = mascotaParaDueno(fila);
    const urlFoto = fila.claveFoto ? (await ports.almacenamiento.getDownloadUrl(fila.claveFoto)).url : null;
    return { ...mascota, urlFoto };
}
/**
 * Paso previo: el cliente sube la foto directo a `PuertoAlmacenamiento` (el backend
 * nunca recibe el binario, sección 12) y luego confirma la clave con `confirmarFotoMascota`.
 * La extensión queda en la clave para que el servidor de archivos sepa qué tipo servir.
 */
export async function solicitarUrlSubidaFotoMascota(ports, idDueno, idMascota, mime) {
    await obtenerMascotaDelDueno(idDueno, idMascota);
    const clave = `pets/${idMascota}/${randomUUID()}.${EXTENSION_POR_MIME[mime]}`;
    const { url, method } = await ports.almacenamiento.getUploadUrl(clave, mime);
    return { clave, url, method };
}
/** Fija la clave subida como foto de la mascota. Solo acepta claves emitidas para esa misma mascota. */
export async function confirmarFotoMascota(ports, idDueno, idMascota, clave) {
    await obtenerMascotaDelDueno(idDueno, idMascota);
    const patron = new RegExp(`^pets/${idMascota}/[0-9a-f-]{36}\\.(jpg|png|webp)$`);
    if (!patron.test(clave)) {
        throw new ErrorSolicitudInvalida("La clave de la foto no corresponde a esta mascota");
    }
    const [actualizada] = await db.update(mascotas).set({ claveFoto: clave }).where(eq(mascotas.id, idMascota)).returning();
    solicitarProyeccionPerfilPublico(ports, idMascota);
    return mascotaParaDuenoConFoto(ports, actualizada);
}
