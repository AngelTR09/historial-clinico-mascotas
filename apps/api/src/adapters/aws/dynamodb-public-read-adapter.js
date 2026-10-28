import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
/**
 * Implementación AWS de `PublicReadPort`: lee la proyección desnormalizada de
 * `hcm-public-profile`, para que la ficha pública siga respondiendo aunque
 * PostgreSQL esté caído o en failover (tabla de SLA del PDF).
 *
 * Contrato del ítem que escribe el proyector:
 *   { qr_token, perfil, actualizado_en }
 *   `perfil` tiene la forma de PerfilPublicoMascota (packages/shared) pero con
 *   `claveFoto` en lugar de `urlFoto`: la URL firmada caduca, así que se firma
 *   aquí, al leer, con el puerto de almacenamiento.
 */
export class AdaptadorLecturaPublicaDynamoDb {
    tabla;
    almacenamiento;
    cliente;
    constructor({ tabla, almacenamiento, cliente = DynamoDBDocumentClient.from(new DynamoDBClient({})) }) {
        this.tabla = tabla;
        this.almacenamiento = almacenamiento;
        this.cliente = cliente;
    }
    async getPetProfileByQrToken(tokenQr) {
        const { Item } = await this.cliente.send(new GetCommand({ TableName: this.tabla, Key: { qr_token: tokenQr } }));
        if (!Item?.perfil) {
            return null;
        }
        const { claveFoto, ...perfil } = Item.perfil;
        const urlFoto = claveFoto ? (await this.almacenamiento.getDownloadUrl(claveFoto)).url : null;
        return { ...perfil, urlFoto };
    }
}
