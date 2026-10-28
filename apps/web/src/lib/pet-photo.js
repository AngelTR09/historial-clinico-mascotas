import { api } from "../api/client";

const LADO_MAXIMO_PX = 800;
const CALIDAD_JPEG = 0.85;

/**
 * Reduce la foto en el navegador antes de subirla, como hace WhatsApp con la foto de
 * perfil: una captura de cámara pesa varios MB y la ficha del QR solo la muestra en
 * un círculo. Devuelve un JPEG cuadrado recortado al centro (lado ≤ 800 px). Si el
 * navegador no puede decodificarla, lanza un error legible.
 */
export async function prepararFotoMascota(archivo) {
    if (!archivo.type.startsWith("image/")) {
        throw new Error("El archivo elegido no es una imagen.");
    }
    let bitmap;
    try {
        bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    }
    catch {
        throw new Error("No se pudo leer la imagen. Prueba con otra foto.");
    }
    const lado = Math.min(bitmap.width, bitmap.height);
    const destino = Math.min(lado, LADO_MAXIMO_PX);
    const lienzo = document.createElement("canvas");
    lienzo.width = destino;
    lienzo.height = destino;
    lienzo.getContext("2d").drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, destino, destino);
    bitmap.close?.();
    const blob = await new Promise((resolver) => lienzo.toBlob(resolver, "image/jpeg", CALIDAD_JPEG));
    if (!blob) {
        throw new Error("No se pudo procesar la imagen.");
    }
    return blob;
}

/** Sube la foto directo al almacenamiento (el backend nunca recibe el binario) y la fija en la mascota. */
export async function subirFotoMascota(idMascota, blob) {
    const { clave, url } = await api.post(`/pets/${idMascota}/photo/upload-url`, { mime: blob.type });
    await api.putRaw(url, blob);
    return api.put(`/pets/${idMascota}/photo`, { clave });
}
