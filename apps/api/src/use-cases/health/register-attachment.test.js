import "../../env.js";
import { CUOTA_OCR_DIARIA_POR_DUENO } from "@hcm/shared";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { adjuntos } from "../../db/schema.js";
import { limpiarFixtures, crearRastreadorFixtures, crearEventoSaludAislado, crearDuenoYMascotaAislados } from "../../test-support/fixtures.js";
import { registrarAdjunto } from "./register-attachment.js";
function puertosFalsos() {
    const topicosEncolados = [];
    const ports = {
        cola: {
            enqueue: (topic) => {
                topicosEncolados.push(topic);
            },
            subscribe: () => { },
        },
    };
    return { ports, topicosEncolados };
}
const rastreador = crearRastreadorFixtures();
const idsAdjuntosCreados = [];
afterEach(async () => {
    for (const id of idsAdjuntosCreados.splice(0)) {
        await db.delete(adjuntos).where(eq(adjuntos.id, id));
    }
    await limpiarFixtures(rastreador);
});
describe("registrarAdjunto — cuota de OCR", () => {
    it("encola OCR normalmente mientras el dueño no supere la cuota diaria", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const idEvento = await crearEventoSaludAislado(rastreador, { idMascota, idDueno });
        const { ports, topicosEncolados } = puertosFalsos();
        const adjunto = await registrarAdjunto(ports, idDueno, {
            idEvento,
            claveS3: `attachments/${idEvento}/test-under-quota.png`,
            mime: "image/png",
            tamanoBytes: 10,
        });
        idsAdjuntosCreados.push(adjunto.id);
        expect(adjunto.estadoOcr).toBe("pendiente");
        expect(topicosEncolados).toEqual(["ocr"]);
    });
    it("omite el OCR sin bloquear la escritura una vez superada la cuota diaria", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const idEvento = await crearEventoSaludAislado(rastreador, { idMascota, idDueno });
        // Llena la cuota del día con adjuntos ya "procesados" antes de esta prueba.
        const relleno = await db
            .insert(adjuntos)
            .values(Array.from({ length: CUOTA_OCR_DIARIA_POR_DUENO }, (_, i) => ({
            idEvento: idEvento,
            claveS3: `attachments/${idEvento}/filler-${i}.png`,
            mime: "image/png",
            tamanoBytes: 10,
            estadoOcr: "procesado",
        })))
            .returning({ id: adjuntos.id });
        idsAdjuntosCreados.push(...relleno.map((f) => f.id));
        const { ports, topicosEncolados } = puertosFalsos();
        const adjunto = await registrarAdjunto(ports, idDueno, {
            idEvento,
            claveS3: `attachments/${idEvento}/test-over-quota.png`,
            mime: "image/png",
            tamanoBytes: 10,
        });
        idsAdjuntosCreados.push(adjunto.id);
        expect(adjunto.estadoOcr).toBe("omitido");
        expect(topicosEncolados).toEqual([]);
    });
});
