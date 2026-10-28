import { describe, expect, it } from "vitest";
import { AdaptadorLecturaPublicaDynamoDb } from "./dynamodb-public-read-adapter.js";

const almacenamiento = { getDownloadUrl: async (clave) => ({ url: `https://s3/firmada/${clave}`, expiraEn: "2030-01-01T00:00:00.000Z" }) };

function adaptadorCon(item) {
    const consultas = [];
    const cliente = { send: async (comando) => (consultas.push(comando.input), { Item: item }) };
    return { consultas, adaptador: new AdaptadorLecturaPublicaDynamoDb({ tabla: "hcm-public-profile", almacenamiento, cliente }) };
}

describe("AdaptadorLecturaPublicaDynamoDb (PublicReadPort sobre la proyección)", () => {
    it("lee por qr_token y firma la foto al leer, sin exponer la clave de S3", async () => {
        const { consultas, adaptador } = adaptadorCon({
            qr_token: "tok",
            perfil: { tokenQr: "tok", nombreMascota: "Luna", claveFoto: "fotos/luna.jpg", vacunas: [] },
        });
        const perfil = await adaptador.getPetProfileByQrToken("tok");
        expect(consultas[0]).toEqual({ TableName: "hcm-public-profile", Key: { qr_token: "tok" } });
        expect(perfil.nombreMascota).toBe("Luna");
        expect(perfil.urlFoto).toBe("https://s3/firmada/fotos/luna.jpg");
        expect(perfil).not.toHaveProperty("claveFoto");
    });

    it("sin foto devuelve urlFoto null", async () => {
        const { adaptador } = adaptadorCon({ qr_token: "tok", perfil: { tokenQr: "tok", nombreMascota: "Luna", claveFoto: null } });
        expect((await adaptador.getPetProfileByQrToken("tok")).urlFoto).toBeNull();
    });

    it("un token que no está proyectado devuelve null (la ruta responde 404)", async () => {
        const { adaptador } = adaptadorCon(undefined);
        expect(await adaptador.getPetProfileByQrToken("desconocido")).toBeNull();
    });
});
