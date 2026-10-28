import { leerSecretoJson } from "../adapters/aws/secrets-manager-reader.js";

/**
 * Se ejecuta una vez por arranque en frío, ANTES de importar `config.js` (que valida el entorno al
 * cargarse): marca el proceso como trabajador y, si la función está en la VPC, trae de Secrets Manager
 * la contraseña de RDS. ECS inyecta ese secreto como variable de entorno; Lambda no, y poner la
 * contraseña en una variable de entorno de la función la dejaría visible en la consola.
 *
 * Es la única excepción a "solo `config.js` lee `process.env`": `entorno` se recibe para poder probarlo.
 */
export async function prepararEntornoTrabajador({ leerSecreto = leerSecretoJson, entorno = process.env } = {}) {
    entorno.PROCESO = "trabajador";
    if (entorno.ARN_SECRETO_BD && !entorno.DB_PASSWORD) {
        const { username, password } = await leerSecreto(entorno.ARN_SECRETO_BD);
        entorno.DB_USER = username;
        entorno.DB_PASSWORD = password;
    }
}
