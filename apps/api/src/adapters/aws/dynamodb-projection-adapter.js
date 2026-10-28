import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Implementación AWS de `ProjectionPort`: escribe en `hcm-public-profile` el ítem que
 * `AdaptadorLecturaPublicaDynamoDb` lee: `{ qr_token, perfil, actualizado_en }`.
 * El error se propaga: el proyector corre como Lambda alimentada por SQS, así que reintenta
 * y, agotados los intentos, el mensaje queda en la DLQ.
 */
export class AdaptadorProyeccionDynamoDb {
    tabla;
    cliente;
    constructor({ tabla, cliente = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } }) }) {
        this.tabla = tabla;
        this.cliente = cliente;
    }
    async guardarPerfil(tokenQr, perfil) {
        await this.cliente.send(new PutCommand({
            TableName: this.tabla,
            Item: { qr_token: tokenQr, perfil, actualizado_en: new Date().toISOString() },
        }));
    }
}
