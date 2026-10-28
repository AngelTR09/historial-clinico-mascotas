import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { solicitarProyeccionPerfilPublico } from "../use-cases/public/request-public-profile-projection.js";
import { colaCuracion, eventosSalud, catalogoVacunas } from "../db/schema.js";
import { mejorCoincidenciaVacuna, normalizarTexto, UMBRAL_AUTO_MATCH_VACUNA, UMBRAL_SUGERENCIA_VACUNA } from "../normalizer/similarity.js";
/**
 * Consumidor local del tópico 'normalizer' (PuertoCola). En la nube este
 * mismo cuerpo corre como Lambda (`workers/normalizer`); aquí solo cambia
 * quién lo invoca. Nunca bloquea el registro del evento — la escritura
 * de `health_events` ya ocurrió antes de encolar este trabajo (RN 7/RN 8).
 */
export function registrarTrabajadorNormalizador(ports) {
    ports.cola.subscribe("normalizer", async (trabajo) => {
        const candidatos = await db
            .select({ id: catalogoVacunas.id, nombreCanonico: catalogoVacunas.nombreCanonico })
            .from(catalogoVacunas)
            .where(and(eq(catalogoVacunas.especie, trabajo.species), eq(catalogoVacunas.activo, true)));
        const match = mejorCoincidenciaVacuna(trabajo.textoOriginal, candidatos);
        if (match && match.score >= UMBRAL_AUTO_MATCH_VACUNA) {
            const [actualizado] = await db.update(eventosSalud).set({ vacunaCanonicaId: match.candidate.id }).where(eq(eventosSalud.id, trabajo.idEvento)).returning({ idMascota: eventosSalud.idMascota });
            // El nombre canónico reemplaza al texto libre en la ficha pública.
            if (actualizado) {
                solicitarProyeccionPerfilPublico(ports, actualizado.idMascota);
            }
            return;
        }
        await registrarOActualizarCuraduria(trabajo.textoOriginal, match && match.score >= UMBRAL_SUGERENCIA_VACUNA ? match.candidate.id : null);
    });
}
/**
 * Agrupa por texto normalizado (mismo criterio que la comparación de
 * vacunas) para que "Antirrábica", "antirrabica" y "ANTIRRÁBICA" sumen a
 * la misma fila en vez de crear una por cada variante de escritura.
 */
async function registrarOActualizarCuraduria(textoOriginal, sugerenciaId) {
    const normalizado = normalizarTexto(textoOriginal);
    const pendientes = await db.select().from(colaCuracion).where(eq(colaCuracion.estado, "pendiente"));
    const existente = pendientes.find((fila) => normalizarTexto(fila.textoOriginal) === normalizado);
    if (existente) {
        await db.update(colaCuracion).set({ ocurrencias: existente.ocurrencias + 1 }).where(eq(colaCuracion.id, existente.id));
        return;
    }
    await db.insert(colaCuracion).values({ textoOriginal, ocurrencias: 1, sugerenciaId, estado: "pendiente" });
}
