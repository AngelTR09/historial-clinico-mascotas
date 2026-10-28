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
/**
 * RF 02. `codigoPublico` y `tokenQr` los genera el backend, nunca el
 * cliente (RN 1: el QR es un token opaco separado del código
 * identificador). Reintenta ante una colisión improbable del código
 * público de 9 dígitos.
 */
export async function registrarMascota(ports, idDueno, input) {
    let ultimoError;
    for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento++) {
        try {
            const [insertada] = await db
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
            solicitarProyeccionPerfilPublico(ports, insertada.id);
            return {
                id: insertada.id,
                idDueno: insertada.idDueno,
                codigoPublico: insertada.codigoPublico,
                tokenQr: insertada.tokenQr,
                nombre: insertada.nombre,
                especie: insertada.especie,
                raza: insertada.raza,
                sexo: insertada.sexo,
                fechaNacimientoAprox: insertada.fechaNacimientoAprox,
                claveFoto: insertada.claveFoto,
                estado: insertada.estado,
                ubigeoDistrito: insertada.ubigeoDistrito,
                creadoEn: insertada.creadoEn.toISOString(),
            };
        }
        catch (error) {
            if (!esViolacionDeUnicidad(error)) {
                throw error;
            }
            ultimoError = error;
        }
    }
    throw ultimoError instanceof Error ? ultimoError : new Error("No se pudo generar un public_code único");
}
