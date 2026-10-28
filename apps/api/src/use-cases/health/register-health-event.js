import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { eventosSalud, mascotas, veterinarios } from "../../db/schema.js";
import { ErrorConflicto, ErrorProhibido, ErrorNoEncontrado } from "../../domain/errors.js";
import { solicitarProyeccionPerfilPublico } from "../public/request-public-profile-projection.js";
function aEventoSalud(row) {
    return {
        id: row.id,
        idMascota: row.idMascota,
        tipo: row.tipo,
        fechaEvento: row.fechaEvento,
        textoOriginal: row.textoOriginal,
        vacunaCanonicaId: row.vacunaCanonicaId,
        nombreProfesional: row.nombreProfesional,
        nivelConfianza: row.nivelConfianza,
        corrigeEventoId: row.corrigeEventoId,
        claveIdempotencia: row.claveIdempotencia,
        creadoPor: row.creadoPor,
        creadoPorVeterinario: row.creadoPorVeterinario,
        creadoEn: row.creadoEn.toISOString(),
    };
}
/**
 * RN 6: reintentar la misma clave devuelve el evento ya creado, pero solo si
 * es el mismo envío. Una clave reutilizada para otra mascota nunca debe
 * devolver (ni filtrar) un evento ajeno.
 */
function reintentoIdempotente(existente, idMascota) {
    if (existente.idMascota !== idMascota) {
        throw new ErrorConflicto("La clave de idempotencia ya se usó en otro registro");
    }
    return aEventoSalud(existente);
}
async function mascotaDelDueno(idDueno, idMascota) {
    const [mascota] = await db
        .select({ species: mascotas.especie })
        .from(mascotas)
        .where(and(eq(mascotas.id, idMascota), eq(mascotas.idDueno, idDueno)))
        .limit(1);
    if (!mascota) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    return mascota;
}
/**
 * Camino común del dueño y del veterinario. `claveIdempotencia` es único por
 * diseño (RN 6): si el cliente reintenta el mismo envío, se devuelve el evento
 * ya creado en vez de duplicarlo o fallar. Si es una vacuna, se encola para
 * normalización (RN 7: `vacunaCanonicaId` la llena el normalizador, nunca el
 * cliente) sin que el registro espere ese resultado. También pide reproyectar la ficha
 * pública, que muestra las últimas vacunas. La inserción es una sola
 * sentencia: si falla, el expediente queda sin cambios (RNF 04).
 */
async function crearEventoSalud(ports, { idMascota, especie, autor, nombreProfesional, nivelConfianza, input }) {
    const [existente] = await db
        .select()
        .from(eventosSalud)
        .where(eq(eventosSalud.claveIdempotencia, input.claveIdempotencia))
        .limit(1);
    if (existente) {
        return reintentoIdempotente(existente, idMascota);
    }
    if (input.corrigeEventoId) {
        const [original] = await db
            .select({ idMascota: eventosSalud.idMascota })
            .from(eventosSalud)
            .where(eq(eventosSalud.id, input.corrigeEventoId))
            .limit(1);
        if (!original || original.idMascota !== idMascota) {
            throw new ErrorNoEncontrado("El evento que se intenta corregir no existe para esta mascota");
        }
    }
    const [insertado] = await db
        .insert(eventosSalud)
        .values({
        idMascota,
        tipo: input.tipo,
        fechaEvento: input.fechaEvento,
        textoOriginal: input.textoOriginal,
        nombreProfesional,
        corrigeEventoId: input.corrigeEventoId ?? null,
        claveIdempotencia: input.claveIdempotencia,
        nivelConfianza,
        ...autor,
    })
        .onConflictDoNothing({ target: eventosSalud.claveIdempotencia })
        .returning();
    if (!insertado) {
        // Otro envío con la misma clave ganó la carrera entre el SELECT y el INSERT (RN 6).
        const [ganador] = await db.select().from(eventosSalud).where(eq(eventosSalud.claveIdempotencia, input.claveIdempotencia)).limit(1);
        if (!ganador) {
            throw new Error("No se pudo crear el evento de salud");
        }
        return reintentoIdempotente(ganador, idMascota);
    }
    if (insertado.tipo === "vacuna") {
        ports.cola.enqueue("normalizer", { idEvento: insertado.id, textoOriginal: insertado.textoOriginal, species: especie });
        solicitarProyeccionPerfilPublico(ports, idMascota);
    }
    return aEventoSalud(insertado);
}
/**
 * RF 04. Evento que declara el dueño sobre su propia mascota: nace `declarado`.
 */
export async function registrarEventoSalud(ports, idDueno, input) {
    const mascota = await mascotaDelDueno(idDueno, input.idMascota);
    return crearEventoSalud(ports, {
        idMascota: input.idMascota,
        especie: mascota.species,
        autor: { creadoPor: idDueno },
        nombreProfesional: input.nombreProfesional ?? null,
        nivelConfianza: "declarado",
        input,
    });
}
/**
 * RN 3: el veterinario registra directamente lo que atiende (atención, vacuna,
 * desparasitación) y el evento nace `verificado`, sin paso de validación del dueño.
 * El acceso temporal por QR (RN 10) dura hasta 4 h, así que aquí se vuelve a comprobar
 * que la cuenta sigue aprobada: un veterinario revocado no escribe con un token vigente.
 * Una corrección sigue sin editar el original: crea un evento nuevo (RN 2).
 */
export async function registrarEventoSaludVeterinario(ports, idVeterinario, idMascota, input) {
    const [veterinario] = await db
        .select({ estado: veterinarios.estado, razonSocial: veterinarios.razonSocial })
        .from(veterinarios)
        .where(eq(veterinarios.id, idVeterinario))
        .limit(1);
    if (!veterinario || veterinario.estado !== "aprobado") {
        throw new ErrorProhibido("La cuenta profesional no está aprobada");
    }
    const [mascota] = await db.select({ species: mascotas.especie }).from(mascotas).where(eq(mascotas.id, idMascota)).limit(1);
    if (!mascota) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    return crearEventoSalud(ports, {
        idMascota,
        especie: mascota.species,
        autor: { creadoPorVeterinario: idVeterinario },
        nombreProfesional: veterinario.razonSocial ?? null,
        nivelConfianza: "verificado",
        input,
    });
}
