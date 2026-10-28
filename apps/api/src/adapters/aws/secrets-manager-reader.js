import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

/**
 * Lee un secreto de Secrets Manager que guarda un JSON (como el de RDS: `{ username, password }`).
 * ECS inyecta los secretos como variables de entorno al arrancar la tarea; una Lambda no tiene ese
 * mecanismo, así que lo pide ella al arrancar. Nunca se registra el valor.
 */
export async function leerSecretoJson(arnSecreto, cliente = new SecretsManagerClient({})) {
    const { SecretString } = await cliente.send(new GetSecretValueCommand({ SecretId: arnSecreto }));
    if (!SecretString) {
        throw new Error("El secreto no tiene un valor de texto");
    }
    return JSON.parse(SecretString);
}
