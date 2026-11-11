import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { TEMA_NORMALIZADOR } from "../domain/temas-cola.js";
import { solicitarProyeccionPerfilPublico } from "../use-cases/public/request-public-profile-projection.js";
import { colaCuracion, eventosSalud, catalogoVacunas } from "../db/schema.js";
import { mejorCoincidenciaVacuna, normalizarTexto, UMBRAL_AUTO_MATCH_VACUNA, UMBRAL_SUGERENCIA_VACUNA } from "../normalizer/similarity.js";
/**
 * Consumidor del tópico 'normalizer' (PuertoCola). En la nube este mismo cuerpo corre como la Lambda
 * `normalizador`; aquí solo cambia quién lo invoca. Nunca bloquea el registro del evento: la escritura
 * de `health_events` ya ocurrió antes de encolar este trabajo (RN 7 y RN 8).
 *
 * Es idempotente, porque SQS entrega al menos una vez y el barrido diario vuelve a encolar lo que no
 * se atendió: cada evento se atiende una sola vez, y lo marca `normalized_at`. La marca y su efecto
 * (vincular al catálogo o sumar a la curaduría) van en la misma transacción, así que un fallo a mitad
 * deja el evento sin marcar y el reintento lo procesa entero.
 */
export function registrarTrabajadorNormalizador(ports) {
    ports.cola.subscribe(TEMA_NORMALIZADOR, async (trabajo) => {
        const candidatos = await db
            .select({ id: catalogoVacunas.id, nombreCanonico: catalogoVacunas.nombreCanonico })
            .from(catalogoVacunas)
            .where(and(eq(catalogoVacunas.especie, trabajo.species), eq(catalogoVacunas.activo, true)));
        const match = mejorCoincidenciaVacuna(trabajo.textoOriginal, candidatos);
        const vinculada = match && match.score >= UMBRAL_AUTO_MATCH_VACUNA ? match.candidate.id : null;
        const idMascotaVinculada = await db.transaction(async (tx) => {
            const [atendido] = await tx
                .update(eventosSalud)
                .set({ normalizadoEn: new Date(), ...(vinculada ? { vacunaCanonicaId: vinculada } : {}) })
                .where(and(eq(eventosSalud.id, trabajo.idEvento), isNull(eventosSalud.normalizadoEn)))
                .returning({ idMascota: eventosSalud.idMascota });
            if (!atendido) {
                // Mensaje repetido, o el evento ya no existe: no hay nada que hacer.
                return null;
            }
            if (vinculada) {
                return atendido.idMascota;
            }
            await registrarOActualizarCuraduria(tx, trabajo.textoOriginal, match && match.score >= UMBRAL_SUGERENCIA_VACUNA ? match.candidate.id : null);
            return null;
        });
        // El nombre canónico reemplaza al texto libre en la ficha pública. Se espera: en una Lambda el
        // envío a la cola se perdería al congelarse la función.
        if (idMascotaVinculada) {
            await solicitarProyeccionPerfilPublico(ports, idMascotaVinculada);
        }
    });
}
/**
 * Agrupa por texto normalizado (mismo criterio que la comparación de
 * vacunas) para que "Antirrábica", "antirrabica" y "ANTIRRÁBICA" sumen a
 * la misma fila en vez de crear una por cada variante de escritura.
 */
async function registrarOActualizarCuraduria(tx, textoOriginal, sugerenciaId) {
    const normalizado = normalizarTexto(textoOriginal);
    const pendientes = await tx.select().from(colaCuracion).where(eq(colaCuracion.estado, "pendiente"));
    const existente = pendientes.find((fila) => normalizarTexto(fila.textoOriginal) === normalizado);
    if (existente) {
        await tx.update(colaCuracion).set({ ocurrencias: existente.ocurrencias + 1 }).where(eq(colaCuracion.id, existente.id));
        return;
    }
    await tx.insert(colaCuracion).values({ textoOriginal, ocurrencias: 1, sugerenciaId, estado: "pendiente" });
}
