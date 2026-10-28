import { AdaptadorAutenticacionJwtLocal } from "./adapters/local/local-jwt-auth-adapter.js";
import { AdaptadorOcrSimulado } from "./adapters/local/stub-ocr-adapter.js";
import { AdaptadorLecturaPublicaDynamoDb } from "./adapters/aws/dynamodb-public-read-adapter.js";
import { AdaptadorProyeccionDynamoDb } from "./adapters/aws/dynamodb-projection-adapter.js";
import { AdaptadorNotificacionSes } from "./adapters/aws/ses-notify-adapter.js";
import { AdaptadorAlmacenamientoS3 } from "./adapters/aws/s3-storage-adapter.js";
import { AdaptadorColaSqs } from "./adapters/aws/sqs-queue-adapter.js";
import { config } from "./config.js";
/**
 * Ensamblado AWS: se carga solo cuando `PROVEEDOR=aws`, así el modo local no
 * arrastra el SDK. Los valores obligatorios ya los validó `config.js`.
 *
 * Quedan locales a propósito, hasta su propio paso:
 *   - `autenticacion`: JWT firmado con `JWT_SECRET`. Cognito exige antes el login
 *     con código y vincular cada dueño con su `sub`.
 *   - `ocr`: simulado. El OCR está diferido en el PMV (`OCR_ENABLED=false`).
 *
 * La API solo pide el proyector (`projector`); lo consume la Lambda `proyector`. El correo sale
 * por SES, así llegan el código de login y los recordatorios.
 */
export function construirPuertosAws() {
    const almacenamiento = new AdaptadorAlmacenamientoS3({ bucket: config.BUCKET_EVIDENCIAS });
    return {
        almacenamiento,
        ocr: new AdaptadorOcrSimulado(),
        cola: new AdaptadorColaSqs({
            urls: { normalizer: config.URL_COLA_NORMALIZACION, projector: config.URL_COLA_PROYECCION },
            temasOmitidos: ["ocr"],
        }),
        autenticacion: new AdaptadorAutenticacionJwtLocal(),
        notificacion: new AdaptadorNotificacionSes({ remitente: config.CORREO_REMITENTE }),
        lecturaPublica: new AdaptadorLecturaPublicaDynamoDb({ tabla: config.TABLA_PERFIL_PUBLICO, almacenamiento }),
        proyeccion: new AdaptadorProyeccionDynamoDb({ tabla: config.TABLA_PERFIL_PUBLICO }),
    };
}
