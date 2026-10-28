/**
 * La placa QR codifica la URL de la ficha pública (`https://.../p/<token>`),
 * pero el acceso del veterinario necesita solo el token. Acepta tanto la URL
 * completa (lo que lee la cámara) como el token suelto (lo que se pega a mano).
 * Nunca interpreta `public_code`: RN 1.
 */
export function extraerTokenQr(texto) {
    const limpio = texto.trim();
    try {
        const coincidencia = new URL(limpio).pathname.match(/^\/p\/([^/]+)\/?$/);
        if (coincidencia) {
            return decodeURIComponent(coincidencia[1]);
        }
    }
    catch {
        // No es una URL: es el token suelto.
    }
    return limpio;
}
