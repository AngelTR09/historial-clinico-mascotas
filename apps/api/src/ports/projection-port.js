/**
 * PuertoProyeccion — contrato que debe cumplir cualquier adaptador que escriba el modelo de
 * lectura del canal público (la proyección desnormalizada del QR). Es el lado de escritura de
 * `PuertoLecturaPublica`. En local: un mapa en memoria. En la nube: DynamoDB.
 *
 *   guardarPerfil(tokenQr, perfil) -> Promise<void>
 *     perfil: ficha pública con `claveFoto` (no la URL: una URL firmada caduca).
 *     Reemplaza el ítem completo, así que reintentar el mismo mensaje es seguro (SQS entrega
 *     al menos una vez).
 */
export {};
