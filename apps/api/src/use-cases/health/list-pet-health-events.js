import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { eventosSalud, mascotas } from "../../db/schema.js";
import { ErrorNoEncontrado } from "../../domain/errors.js";
export async function listarEventosSaludMascota(idDueno, idMascota) {
    const [mascota] = await db.select({ idDueno: mascotas.idDueno }).from(mascotas).where(eq(mascotas.id, idMascota)).limit(1);
    if (!mascota) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    if (mascota.idDueno !== idDueno) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    const filas = await db
        .select()
        .from(eventosSalud)
        .where(and(eq(eventosSalud.idMascota, idMascota)))
        .orderBy(desc(eventosSalud.fechaEvento));
    return filas.map((fila) => ({
        id: fila.id,
        idMascota: fila.idMascota,
        tipo: fila.tipo,
        fechaEvento: fila.fechaEvento,
        textoOriginal: fila.textoOriginal,
        vacunaCanonicaId: fila.vacunaCanonicaId,
        nombreProfesional: fila.nombreProfesional,
        nivelConfianza: fila.nivelConfianza,
        corrigeEventoId: fila.corrigeEventoId,
        claveIdempotencia: fila.claveIdempotencia,
        creadoPor: fila.creadoPor,
        creadoPorVeterinario: fila.creadoPorVeterinario,
        creadoEn: fila.creadoEn.toISOString(),
    }));
}
