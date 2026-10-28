import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { adjuntos } from "../db/schema.js";
/**
 * Consumidor local del tópico 'ocr' (PuertoCola). En la nube, este mismo
 * cuerpo corre como handler de una Lambda disparada por SQS
 * (`workers/ocr`); aquí solo cambia quién lo invoca.
 */
export function registrarTrabajadorOcr(ports) {
    ports.cola.subscribe("ocr", async (trabajo) => {
        const resultado = await ports.ocr.extractText({ claveS3: trabajo.claveS3, mime: trabajo.mime });
        await db
            .update(adjuntos)
            .set({
            estadoOcr: resultado.status,
            datosOcr: resultado.payload,
            confianzaOcr: resultado.confidence,
        })
            .where(eq(adjuntos.id, trabajo.attachmentId));
    });
}
