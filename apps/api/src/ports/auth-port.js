/**
 * PuertoAutenticacion — contrato que debe cumplir cualquier adaptador de
 * autenticación (no hay interfaces en JS; esto documenta la forma esperada).
 * En local: JWT firmado localmente. En la nube: Cognito.
 *
 *   issueOwnerToken(idDueno) -> Promise<string>
 *   verifyOwnerToken(token) -> Promise<{ idDueno }>
 *   issueVetToken(idVeterinario) -> Promise<string>
 *   verifyVetToken(token) -> Promise<{ idVeterinario }>
 *   issueVetPetAccessToken(idVeterinario, idMascota) -> Promise<{ token, expiraEn }>
 *     RN 10: acceso acotado a una mascota, nacido de escanear su QR.
 *   verifyVetPetAccessToken(token) -> Promise<{ idVeterinario, idMascota }>
 */
export {};
