/**
 * PuertoLecturaPublica — contrato que debe cumplir cualquier adaptador de
 * lectura pública (RF 21). En local consulta PostgreSQL; en la nube, la
 * proyección desnormalizada en DynamoDB (RNF 7: el canal público debe
 * seguir respondiendo aunque Postgres esté en failover). El contrato de
 * salida es el mismo en ambos casos.
 *
 *   getPetProfileByQrToken(tokenQr) -> Promise<PerfilPublicoMascota | null>
 *     (forma de PerfilPublicoMascota: ver packages/shared/src/schemas/pet-public-profile.js)
 */
export {};
