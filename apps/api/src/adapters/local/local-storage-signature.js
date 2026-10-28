import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../../config.js";
/**
 * Emula la firma de una presigned URL de S3 para el servidor de archivos
 * local: HMAC-SHA256 de método + clave + instante de expiración, con una
 * clave derivada de `JWT_SECRET` para que no sirva para nada más. Sin ella,
 * cualquiera con la dirección podría leer una evidencia o escribir un archivo
 * arbitrario en `STORAGE_LOCAL_PATH`.
 */
function claveDeFirma() {
    return createHmac("sha256", config.JWT_SECRET).update("local-storage-signature").digest();
}
function calcularFirma(metodo, key, expires) {
    return createHmac("sha256", claveDeFirma()).update(`${metodo}\n${key}\n${expires}`).digest("hex");
}
/**
 * Base pública del API tal como la ve el cliente. Por defecto `localhost`;
 * para probar desde otro dispositivo de la red se fija `API_PUBLIC_URL`
 * con la IP de la máquina, o la imagen apuntaría al propio dispositivo.
 */
export function urlBasePublica() {
    return (config.API_PUBLIC_URL ?? `http://localhost:${config.PORT}`).replace(/\/$/, "");
}
export function urlAlmacenamientoFirmada(metodo, key, segundosVigencia) {
    const expiraEnSegundos = Math.floor(Date.now() / 1000) + segundosVigencia;
    const firma = calcularFirma(metodo, key, expiraEnSegundos);
    return {
        url: `${urlBasePublica()}/local-storage/${encodeURIComponent(key)}?expires=${expiraEnSegundos}&sig=${firma}`,
        expiraEn: new Date(expiraEnSegundos * 1000).toISOString(),
    };
}
export function firmaAlmacenamientoValida(metodo, key, expires, firma) {
    const expiraEnSegundos = Number(expires);
    if (!Number.isInteger(expiraEnSegundos) || typeof firma !== "string" || expiraEnSegundos < Math.floor(Date.now() / 1000)) {
        return false;
    }
    const esperada = Buffer.from(calcularFirma(metodo, key, expiraEnSegundos));
    const recibida = Buffer.from(firma);
    return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}
