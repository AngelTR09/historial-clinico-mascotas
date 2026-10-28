import { CUOTA_OCR_DIARIA_POR_DUENO } from "@hcm/shared";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { adjuntos, eventosSalud, mascotas } from "../../db/schema.js";
import { ErrorNoEncontrado } from "../../domain/errors.js";
function aAdjunto(row) {
    return {
        id: row.id,
        idEvento: row.idEvento,
        claveS3: row.claveS3,
        mime: row.mime,
        tamanoBytes: row.tamanoBytes,
        estadoOcr: row.estadoOcr,
        datosOcr: row.datosOcr,
        confianzaOcr: row.confianzaOcr,
        creadoEn: row.creadoEn.toISOString(),
    };
}
/** Adjuntos ya recibidos hoy de este dueño, sin importar su mascota o evento. */
async function contarAdjuntosHoy(idDueno) {
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);
    const [fila] = await db
        .select({ count: sql `count(*)::int` })
        .from(adjuntos)
        .innerJoin(eventosSalud, eq(eventosSalud.id, adjuntos.idEvento))
        .innerJoin(mascotas, eq(mascotas.id, eventosSalud.idMascota))
        .where(and(eq(mascotas.idDueno, idDueno), gte(adjuntos.creadoEn, inicioDelDia)));
    return fila?.count ?? 0;
}
/**
 * RF 06. El OCR se encola y se procesa aparte (RN 8): esta función nunca
 * espera a `PuertoOcr`, solo deja la evidencia guardada. Si el dueño ya
 * superó su cuota diaria (sección 11), la evidencia igual se guarda —
 * nunca se rechaza la escritura— pero queda `omitido` sin encolar el
 * trabajo de OCR, para no gastar cuota real de Textract en la nube.
 */
export async function registrarAdjunto(ports, idDueno, input) {
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
    const adjuntosHoy = await contarAdjuntosHoy(idDueno);
    const cuotaSuperada = adjuntosHoy >= CUOTA_OCR_DIARIA_POR_DUENO;
    const [insertado] = await db
        .insert(adjuntos)
        .values({
        idEvento: input.idEvento,
        claveS3: input.claveS3,
        mime: input.mime,
        tamanoBytes: input.tamanoBytes,
        estadoOcr: cuotaSuperada ? "omitido" : "pendiente",
    })
        .returning();
    if (!insertado) {
        throw new Error("No se pudo registrar la evidencia");
    }
    if (!cuotaSuperada) {
        ports.cola.enqueue("ocr", { attachmentId: insertado.id, claveS3: insertado.claveS3, mime: insertado.mime });
    }
    return aAdjunto(insertado);
}
