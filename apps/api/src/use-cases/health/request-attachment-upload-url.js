import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { eventosSalud, mascotas } from "../../db/schema.js";
import { ErrorNoEncontrado } from "../../domain/errors.js";
/**
 * Paso previo a RF 06: el cliente sube el binario directo a `PuertoAlmacenamiento`
 * (nunca al backend, sección 12) y recién después confirma los metadatos
 * con `registrarAdjunto`.
 */
export async function solicitarUrlSubidaAdjunto(ports, idDueno, input) {
    const [evento] = await db
        .select({ id: eventosSalud.id, idDueno: mascotas.idDueno })
        .from(eventosSalud)
        .innerJoin(mascotas, eq(mascotas.id, eventosSalud.idMascota))
        .where(eq(eventosSalud.id, input.idEvento))
        .limit(1);
    if (!evento) {
        throw new ErrorNoEncontrado("El evento de salud no existe");
    }
    if (evento.idDueno !== idDueno) {
        throw new ErrorNoEncontrado("El evento de salud no existe");
    }
    const clave = `attachments/${input.idEvento}/${randomUUID()}`;
    const { url, method } = await ports.almacenamiento.getUploadUrl(clave, input.mime);
    return { clave, url, method };
}
