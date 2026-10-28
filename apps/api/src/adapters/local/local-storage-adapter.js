import { urlAlmacenamientoFirmada } from "./local-storage-signature.js";
const MINUTOS_VIGENCIA_URL = 15;
/**
 * Emula las presigned URLs de S3 apuntando a `/local-storage/:key` de este
 * mismo servidor (ver `routes/local-storage.js`), que lee y escribe en
 * `STORAGE_LOCAL_PATH`. Igual que en S3, cada URL lleva firma y caducidad
 * y la ruta las hace cumplir.
 */
export class AdaptadorAlmacenamientoLocal {
    async getUploadUrl(key, _mime) {
        return { url: urlAlmacenamientoFirmada("PUT", key, MINUTOS_VIGENCIA_URL * 60).url, method: "PUT" };
    }
    async getDownloadUrl(key) {
        return urlAlmacenamientoFirmada("GET", key, MINUTOS_VIGENCIA_URL * 60);
    }
}
