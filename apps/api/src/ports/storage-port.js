/**
 * PuertoAlmacenamiento — contrato que debe cumplir cualquier adaptador de
 * almacenamiento. El backend nunca recibe ni sirve el binario de una imagen
 * (sección 12): este puerto solo entrega URLs a las que el cliente sube o
 * de las que lee el archivo directo. En local apuntan al servidor de
 * archivos propio; en la nube, a presigned URLs de S3 — sin que el caso de
 * uso lo note.
 *
 *   getUploadUrl(key, mime) -> Promise<{ url, method: "PUT" }>
 *   getDownloadUrl(key) -> Promise<{ url, expiraEn }>
 *     URL temporal de solo lectura (GET) para una clave ya subida. `expiraEn`
 *     es un instante ISO 8601 que hace cumplir la firma de la propia URL,
 *     tanto en S3 como en el adaptador local.
 */
export {};
