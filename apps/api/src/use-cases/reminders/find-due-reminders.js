import { DIAS_VENTANA_RECORDATORIO_VACUNA, MESES_VIGENCIA_DESPARASITACION } from "@hcm/shared";
import { and, eq, max, ne, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db/client.js";
import { eventosSalud, duenos, mascotas, catalogoVacunas } from "../../db/schema.js";
/**
 * Un evento corregido por otro posterior (RN 2) no cuenta: un registro equivocado no debe adelantar ni
 * posponer un aviso. Vale para vacunas y desparasitaciones.
 */
function sinCorreccionPosterior() {
    const correccion = alias(eventosSalud, "correccion");
    return notExists(db.select({ uno: sql `1` }).from(correccion).where(eq(correccion.corrigeEventoId, eventosSalud.id)));
}
function sumarMeses(fecha, meses) {
    return new Date(fecha.getFullYear(), fecha.getMonth() + meses, fecha.getDate());
}
/**
 * Vacunas. Por cada mascota, la última vacuna registrada de cada tipo canónico es
 * la que manda: una dosis anterior del mismo `vacuna_canonica_id` ya no
 * importa una vez que hay una más reciente. No cuentan los eventos corregidos ni las mascotas
 * fallecidas (nadie quiere un aviso de vacuna de una mascota que murió). Solo cuenta lo que el
 * normalizador ya vinculó al catálogo (RN 7): sin `vacuna_canonica_id` no
 * hay `meses_vigencia` con qué calcular el vencimiento.
 *
 * `idDueno` acota la consulta a un solo dueño (vista de lectura del
 * dashboard); sin él, corre para todos (barrido de `reminders-worker`).
 */
async function buscarVacunasVencidas(fechaReferencia, idDueno) {
    const filas = await db
        .select({
        idMascota: eventosSalud.idMascota,
        nombreMascota: mascotas.nombre,
        correoDueno: duenos.correo,
        vacunaCanonicaId: eventosSalud.vacunaCanonicaId,
        nombreCanonico: catalogoVacunas.nombreCanonico,
        mesesVigencia: catalogoVacunas.mesesVigencia,
        fechaEvento: eventosSalud.fechaEvento,
    })
        .from(eventosSalud)
        .innerJoin(catalogoVacunas, eq(catalogoVacunas.id, eventosSalud.vacunaCanonicaId))
        .innerJoin(mascotas, eq(mascotas.id, eventosSalud.idMascota))
        .innerJoin(duenos, eq(duenos.id, mascotas.idDueno))
        .where(and(eq(eventosSalud.tipo, "vacuna"), ne(mascotas.estado, "fallecida"), idDueno ? eq(mascotas.idDueno, idDueno) : undefined, sinCorreccionPosterior()));
    const ultimaPorMascotaYVacuna = new Map();
    for (const fila of filas) {
        const clave = `${fila.idMascota}:${fila.vacunaCanonicaId}`;
        const existente = ultimaPorMascotaYVacuna.get(clave);
        if (!existente || fila.fechaEvento > existente.fechaEvento) {
            ultimaPorMascotaYVacuna.set(clave, fila);
        }
    }
    const limiteMs = fechaReferencia.getTime() + DIAS_VENTANA_RECORDATORIO_VACUNA * 24 * 60 * 60 * 1000;
    const vencidos = [];
    for (const fila of ultimaPorMascotaYVacuna.values()) {
        const fechaVencimiento = sumarMeses(new Date(fila.fechaEvento), fila.mesesVigencia);
        if (fechaVencimiento.getTime() <= limiteMs) {
            vencidos.push({ tipo: "vacuna", concepto: `vacuna:${fila.vacunaCanonicaId}`, idMascota: fila.idMascota, nombreMascota: fila.nombreMascota, ownerEmail: fila.correoDueno, nombreCanonico: fila.nombreCanonico, dueDate: fechaVencimiento });
        }
    }
    return vencidos;
}

/**
 * Desparasitaciones. No hay catálogo: la última desparasitación de cada mascota vence a los
 * `MESES_VIGENCIA_DESPARASITACION` meses. Tampoco cuentan los eventos corregidos ni las mascotas fallecidas.
 */
async function buscarDesparasitacionesVencidas(fechaReferencia, idDueno) {
    const filas = await db
        .select({
        idMascota: mascotas.id,
        nombreMascota: mascotas.nombre,
        correoDueno: duenos.correo,
        ultima: max(eventosSalud.fechaEvento),
    })
        .from(eventosSalud)
        .innerJoin(mascotas, eq(mascotas.id, eventosSalud.idMascota))
        .innerJoin(duenos, eq(duenos.id, mascotas.idDueno))
        .where(and(eq(eventosSalud.tipo, "desparasitacion"), ne(mascotas.estado, "fallecida"), idDueno ? eq(mascotas.idDueno, idDueno) : undefined, sinCorreccionPosterior()))
        .groupBy(mascotas.id, mascotas.nombre, duenos.correo);
    const limiteMs = fechaReferencia.getTime() + DIAS_VENTANA_RECORDATORIO_VACUNA * 24 * 60 * 60 * 1000;
    const vencidos = [];
    for (const fila of filas) {
        const fechaVencimiento = sumarMeses(new Date(fila.ultima), MESES_VIGENCIA_DESPARASITACION);
        if (fechaVencimiento.getTime() <= limiteMs) {
            vencidos.push({ tipo: "desparasitacion", concepto: "desparasitacion", idMascota: fila.idMascota, nombreMascota: fila.nombreMascota, ownerEmail: fila.correoDueno, nombreCanonico: "Desparasitación", dueDate: fechaVencimiento });
        }
    }
    return vencidos;
}
/** Todo lo que vence dentro de la ventana de aviso: vacunas y desparasitaciones. */
export async function buscarRecordatoriosVencidos(fechaReferencia, idDueno) {
    const [vacunas, desparasitaciones] = await Promise.all([buscarVacunasVencidas(fechaReferencia, idDueno), buscarDesparasitacionesVencidas(fechaReferencia, idDueno)]);
    return [...vacunas, ...desparasitaciones];
}
