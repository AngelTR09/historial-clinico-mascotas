import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { adjuntos, catalogoVacunas, eventosSalud, mascotas } from "../../db/schema.js";
import { ErrorNoEncontrado } from "../../domain/errors.js";

const MAXIMO_CARACTERES_RESUMEN_OCR = 300;

function edadEnMeses(fechaNacimientoAprox) {
    if (!fechaNacimientoAprox) {
        return null;
    }
    const nacimiento = new Date(fechaNacimientoAprox);
    const hoy = new Date();
    const meses = (hoy.getUTCFullYear() - nacimiento.getUTCFullYear()) * 12 + (hoy.getUTCMonth() - nacimiento.getUTCMonth());
    return Math.max(0, meses);
}

function truncar(texto) {
    return texto.length > MAXIMO_CARACTERES_RESUMEN_OCR ? `${texto.slice(0, MAXIMO_CARACTERES_RESUMEN_OCR)}…` : texto;
}

/**
 * `ocr_payload` es JSON libre (cada motor de OCR devuelve algo distinto), así
 * que al veterinario solo se le da un resumen corto en texto: el campo `texto`
 * si existe, o los valores simples del objeto como `clave: valor`.
 */
export function resumirDatosOcr(datosOcr) {
    if (datosOcr === null || datosOcr === undefined) {
        return null;
    }
    if (typeof datosOcr === "string") {
        return datosOcr.trim() ? truncar(datosOcr.trim()) : null;
    }
    if (typeof datosOcr !== "object" || Array.isArray(datosOcr)) {
        return null;
    }
    if (typeof datosOcr.texto === "string" && datosOcr.texto.trim()) {
        return truncar(datosOcr.texto.trim());
    }
    const partes = Object.entries(datosOcr)
        .filter(([, valor]) => ["string", "number", "boolean"].includes(typeof valor))
        .map(([clave, valor]) => `${clave}: ${valor}`);
    return partes.length > 0 ? truncar(partes.join(" · ")) : null;
}

async function aAdjuntoVeterinario(ports, fila) {
    const { url, expiraEn } = await ports.almacenamiento.getDownloadUrl(fila.claveS3);
    return {
        id: fila.id,
        mime: fila.mime,
        tamanoBytes: fila.tamanoBytes,
        estadoOcr: fila.estadoOcr,
        confianzaOcr: fila.confianzaOcr,
        resumenOcr: resumirDatosOcr(fila.datosOcr),
        urlLectura: url,
        urlLecturaExpiraEn: expiraEn,
        creadoEn: fila.creadoEn.toISOString(),
    };
}

/**
 * RF 13 / RN 10: lo que ve el veterinario tras escanear el QR — ficha de la
 * mascota e historial completo con su evidencia. Ya no hay bandeja de validación
 * (RN 3): lo que registra el veterinario nace `verificado` y lo que declaró el dueño
 * se distingue por su `nivelConfianza`. `idMascota` viene del token de acceso acotado, nunca de un dato
 * del cliente. No lee nada del dueño (RN 5) ni expone `creado_por`. Los
 * binarios no pasan por aquí: solo se piden URLs de lectura a `PuertoAlmacenamiento`.
 */
export async function obtenerVistaVeterinarioMascota(ports, idMascota) {
    const [mascota] = await db.select().from(mascotas).where(eq(mascotas.id, idMascota)).limit(1);
    if (!mascota) {
        throw new ErrorNoEncontrado("La mascota no existe");
    }
    const filasEventos = await db
        .select({ evento: eventosSalud, nombreVacunaCanonica: catalogoVacunas.nombreCanonico })
        .from(eventosSalud)
        .leftJoin(catalogoVacunas, eq(catalogoVacunas.id, eventosSalud.vacunaCanonicaId))
        .where(eq(eventosSalud.idMascota, idMascota))
        .orderBy(desc(eventosSalud.fechaEvento), desc(eventosSalud.creadoEn));
    const idsEventos = filasEventos.map((fila) => fila.evento.id);
    const filasAdjuntos = idsEventos.length
        ? await db.select().from(adjuntos).where(inArray(adjuntos.idEvento, idsEventos)).orderBy(asc(adjuntos.creadoEn))
        : [];
    const adjuntosPorEvento = new Map();
    for (const fila of filasAdjuntos) {
        const lista = adjuntosPorEvento.get(fila.idEvento) ?? [];
        lista.push(await aAdjuntoVeterinario(ports, fila));
        adjuntosPorEvento.set(fila.idEvento, lista);
    }
    const eventosPorId = new Map(filasEventos.map((fila) => [fila.evento.id, fila.evento]));
    const corregidoPor = new Map();
    for (const { evento } of filasEventos) {
        if (evento.corrigeEventoId && !corregidoPor.has(evento.corrigeEventoId)) {
            corregidoPor.set(evento.corrigeEventoId, evento.id);
        }
    }
    const historial = [];
    for (const { evento, nombreVacunaCanonica } of filasEventos) {
        const corregido = evento.corrigeEventoId ? eventosPorId.get(evento.corrigeEventoId) : null;
        const vista = {
            id: evento.id,
            tipo: evento.tipo,
            fechaEvento: evento.fechaEvento,
            textoOriginal: evento.textoOriginal,
            nombreVacunaCanonica: nombreVacunaCanonica ?? null,
            nombreProfesional: evento.nombreProfesional,
            nivelConfianza: evento.nivelConfianza,
            corrigeEventoId: evento.corrigeEventoId,
            corrigeEvento: corregido ? { fechaEvento: corregido.fechaEvento, tipo: corregido.tipo, textoOriginal: corregido.textoOriginal } : null,
            corregidoPorEventoId: corregidoPor.get(evento.id) ?? null,
            creadoEn: evento.creadoEn.toISOString(),
            adjuntos: adjuntosPorEvento.get(evento.id) ?? [],
        };
        historial.push(vista);
    }
    const urlFoto = mascota.claveFoto ? (await ports.almacenamiento.getDownloadUrl(mascota.claveFoto)).url : null;
    return {
        mascota: {
            id: mascota.id,
            codigoPublico: mascota.codigoPublico,
            nombre: mascota.nombre,
            especie: mascota.especie,
            raza: mascota.raza,
            sexo: mascota.sexo,
            edadMeses: edadEnMeses(mascota.fechaNacimientoAprox),
            estado: mascota.estado,
            urlFoto,
        },
        historial,
    };
}
