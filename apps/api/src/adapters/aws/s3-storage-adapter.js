import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
const SEGUNDOS_VIGENCIA_URL = 15 * 60;
/**
 * Implementación AWS de `StoragePort`: presigned URLs de S3 (sección 12: el
 * backend nunca recibe ni sirve el binario). La firma incluye el
 * `Content-Type`, así que el cliente debe subir con el mismo `mime` que pidió
 * (`api/client.js` de la web ya envía `file.type`).
 * Un PUT firmado no puede limitar el tamaño del archivo; si hiciera falta,
 * habría que pasar a un POST firmado, que cambia la firma del puerto.
 */
export class AdaptadorAlmacenamientoS3 {
    bucket;
    cliente;
    segundosVigencia;
    constructor({ bucket, cliente = new S3Client({}), segundosVigencia = SEGUNDOS_VIGENCIA_URL }) {
        this.bucket = bucket;
        this.cliente = cliente;
        this.segundosVigencia = segundosVigencia;
    }
    async getUploadUrl(key, mime) {
        const url = await getSignedUrl(this.cliente, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mime }), {
            expiresIn: this.segundosVigencia,
            // El SDK no firma el Content-Type por defecto: sin esto cualquier tipo de archivo pasaría.
            signableHeaders: new Set(["content-type"]),
        });
        return { url, method: "PUT" };
    }
    async getDownloadUrl(key) {
        const url = await getSignedUrl(this.cliente, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
            expiresIn: this.segundosVigencia,
        });
        return { url, expiraEn: new Date(Date.now() + this.segundosVigencia * 1000).toISOString() };
    }
}
