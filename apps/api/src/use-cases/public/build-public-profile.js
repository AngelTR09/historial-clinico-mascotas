import { and, desc, eq, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db/client.js";
import { catalogoVacunas, eventosSalud, mascotas } from "../../db/schema.js";

const DIAS_VIGENCIA_HEURISTICA = 365;
const MAXIMO_VACUNAS_PUBLICAS = 5;

function edadEnMeses(fechaNacimientoAprox) {
    if (!fechaNacimientoAprox) {
        return null;
    }
    const nacimiento = new Date(fechaNacimientoAprox);
    const hoy = new Date();
    const meses = (hoy.getUTCFullYear() - nacimiento.getUTCFullYear()) * 12 + (hoy.getUTCMonth() - nacimiento.getUTCMonth());
    return Math.max(0, meses);
}

/**
 * Construye la ficha pública (RF 21) de una mascota a partir de Postgres. Es el único lugar que
 * decide qué se publica (RN 5): lo usan el adaptador de lectura local y el proyector que llena
 * DynamoDB, así que los dos canales no pueden divergir.
 *
 * Devuelve `claveFoto` y no la URL: una URL firmada caduca, así que la firma quien lee.
 * `estadoVacunacion` es una heurística por fecha del último evento tipo 'vacuna'.
 */
async function perfilDeMascota(mascota) {
    // Una vacuna corregida por un evento posterior (RN 2) no debe aparecer como vigente en la ficha pública.
    const correccion = alias(eventosSalud, "correccion");
    const vacunas = await db
        .select({
        nombreCanonico: catalogoVacunas.nombreCanonico,
        textoOriginal: eventosSalud.textoOriginal,
        fechaEvento: eventosSalud.fechaEvento,
        nivelConfianza: eventosSalud.nivelConfianza,
    })
        .from(eventosSalud)
        .leftJoin(catalogoVacunas, eq(eventosSalud.vacunaCanonicaId, catalogoVacunas.id))
        .where(and(eq(eventosSalud.idMascota, mascota.id), eq(eventosSalud.tipo, "vacuna"), notExists(db.select({ uno: sql `1` }).from(correccion).where(eq(correccion.corrigeEventoId, eventosSalud.id)))))
        .orderBy(desc(eventosSalud.fechaEvento))
        .limit(MAXIMO_VACUNAS_PUBLICAS);
    const ultimaVacuna = vacunas[0];
    const estadoVacunacion = !ultimaVacuna
        ? "sin_registro"
        : (Date.now() - new Date(ultimaVacuna.fechaEvento).getTime()) / 86_400_000 <= DIAS_VIGENCIA_HEURISTICA
            ? "al_dia"
            : "atrasado";
    const estaExtraviada = mascota.estado === "extraviada";
    return {
        tokenQr: mascota.tokenQr,
        nombreMascota: mascota.nombre,
        especie: mascota.especie,
        claveFoto: mascota.claveFoto,
        raza: mascota.raza,
        sexo: mascota.sexo,
        edadMeses: edadEnMeses(mascota.fechaNacimientoAprox),
        colorSenas: mascota.colorSenas,
        esterilizada: mascota.esterilizada,
        // Solo se publican si el dueño lo autorizó; si no, la clave existe pero vale null.
        alertasMedicas: mascota.alertasMedicasPublicas ? mascota.alertasMedicas : null,
        temperamento: mascota.temperamento,
        notaDelDueno: mascota.notaDelDueno,
        extraviadaDesde: estaExtraviada ? mascota.extraviadaDesde : null,
        vacunas: vacunas.map((vacuna) => ({
            nombre: vacuna.nombreCanonico ?? vacuna.textoOriginal,
            fecha: vacuna.fechaEvento,
            nivelConfianza: vacuna.nivelConfianza,
        })),
        estadoVacunacion,
        estaExtraviada,
        mensajeContacto: estaExtraviada
            ? "Si encontraste a esta mascota, comunícate con su dueño usando el formulario de contacto."
            : null,
        actualizadoEn: new Date().toISOString(),
    };
}

export async function construirPerfilPublicoPorToken(tokenQr) {
    const [mascota] = await db.select().from(mascotas).where(eq(mascotas.tokenQr, tokenQr)).limit(1);
    return mascota ? perfilDeMascota(mascota) : null;
}

export async function construirPerfilPublicoPorIdMascota(idMascota) {
    const [mascota] = await db.select().from(mascotas).where(eq(mascotas.id, idMascota)).limit(1);
    return mascota ? perfilDeMascota(mascota) : null;
}
