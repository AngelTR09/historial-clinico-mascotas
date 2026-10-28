import { formatearCodigoPublico, LONGITUD_BASE_CODIGO_PUBLICO } from "@hcm/shared";
import { randomBytes, randomInt } from "node:crypto";
import { db } from "../../db/client.js";
import { mascotas } from "../../db/schema.js";
import { esViolacionDeUnicidad } from "../../domain/db-errors.js";
import { solicitarProyeccionPerfilPublico } from "../public/request-public-profile-projection.js";
const MAX_INTENTOS_CODIGO = 5;
function codigoPublicoAleatorio() {
    const base = String(randomInt(0, 10 ** LONGITUD_BASE_CODIGO_PUBLICO)).padStart(LONGITUD_BASE_CODIGO_PUBLICO, "0");
    return formatearCodigoPublico(base);
}
function tokenQrAleatorio() {
    return randomBytes(16).toString("base64url");
}
function aMascota(row) {
    return {
        id: row.id,
        idDueno: row.idDueno,
        codigoPublico: row.codigoPublico,
        tokenQr: row.tokenQr,
        nombre: row.nombre,
        especie: row.especie,
        raza: row.raza,
        sexo: row.sexo,
        fechaNacimientoAprox: row.fechaNacimientoAprox,
        claveFoto: row.claveFoto,
        estado: row.estado,
        ubigeoDistrito: row.ubigeoDistrito,
        creadoEn: row.creadoEn.toISOString(),
    };
}
/**
 * Alta de camada (RNF: hasta 8 expedientes, < 3 s, atómica). Todo el lote
 * corre dentro de una sola transacción — si cualquier mascota falla tras
 * agotar sus reintentos de código único, ninguna de sus hermanas queda
 * insertada (sección 12: nunca inserciones sueltas que dejen crías
 * huérfanas). Es la misma lógica de reintento de `registrarMascota`, pero
 * corriendo contra el cliente de la transacción (`tx`) en vez de `db`,
 * así que se duplica aquí en vez de compartir un helper que tendría que
 * aceptar indistintamente `db` o `tx`.
 */
export async function registrarCamada(ports, idDueno, inputs) {
    const creadas = await db.transaction(async (tx) => {
        const creadas = [];
        for (const input of inputs) {
            let ultimoError;
            let insertadaEstaMascota = false;
            for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento++) {
                try {
                    const [insertada] = await tx
                        .insert(mascotas)
                        .values({
                        idDueno,
                        codigoPublico: codigoPublicoAleatorio(),
                        tokenQr: tokenQrAleatorio(),
                        nombre: input.nombre,
                        especie: input.especie,
                        raza: input.raza ?? null,
                        sexo: input.sexo ?? null,
                        fechaNacimientoAprox: input.fechaNacimientoAprox ?? null,
                        claveFoto: input.claveFoto ?? null,
                        ubigeoDistrito: input.ubigeoDistrito ?? null,
                        estado: "activa",
                    })
                        .returning();
                    if (!insertada) {
                        throw new Error("No se pudo crear la mascota");
                    }
                    creadas.push(aMascota(insertada));
                    insertadaEstaMascota = true;
                    break;
                }
                catch (error) {
                    if (!esViolacionDeUnicidad(error)) {
                        throw error;
                    }
                    ultimoError = error;
                }
            }
            if (!insertadaEstaMascota) {
                throw ultimoError instanceof Error ? ultimoError : new Error("No se pudo generar un public_code único");
            }
        }
        return creadas;
    });
    // Solo después de confirmar la transacción: una camada revertida no debe proyectar nada.
    for (const mascota of creadas) {
        solicitarProyeccionPerfilPublico(ports, mascota.id);
    }
    return creadas;
}
