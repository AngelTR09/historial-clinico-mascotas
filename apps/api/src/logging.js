/**
 * Campos que nunca deben llegar a CloudWatch/Loki (documentación del proyecto §9 y §12: "una vez ahí, ya está").
 * Los nombres cubren los de este código (castellano) y los de las librerías/columnas (inglés).
 * pino solo admite `*` como un nivel por segmento, así que se cubren hasta tres niveles de profundidad.
 */
const CAMPOS_SENSIBLES = [
    "numeroDocumento",
    "numeroDocumentoCifrado",
    "doc_number",
    "doc_number_enc",
    "telefono",
    "phone",
    "phone_enc",
    "correo",
    "email",
    "direccion",
    "address",
    "codigo",
    "hashCodigo",
    "authorization",
];

export const RUTAS_REDACCION = [
    "req.headers.authorization",
    "req.headers.cookie",
    ...CAMPOS_SENSIBLES.flatMap((campo) => [campo, `*.${campo}`, `*.*.${campo}`, `*.*.*.${campo}`]),
];

export const OPCIONES_REDACCION = { paths: RUTAS_REDACCION, censor: "[redactado]" };
