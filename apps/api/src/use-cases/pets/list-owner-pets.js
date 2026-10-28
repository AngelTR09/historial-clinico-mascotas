import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { mascotas } from "../../db/schema.js";
import { mascotaParaDuenoConFoto } from "./update-pet-photo.js";
export async function listarMascotasDueno(ports, idDueno) {
    const filas = await db.select().from(mascotas).where(eq(mascotas.idDueno, idDueno)).orderBy(desc(mascotas.creadoEn));
    return Promise.all(filas.map((fila) => mascotaParaDuenoConFoto(ports, fila)));
}
