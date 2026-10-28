import { urlAlmacenamientoFirmada } from "./local-storage-signature.js";
import { construirPerfilPublicoPorToken } from "../../use-cases/public/build-public-profile.js";

const MINUTOS_VIGENCIA_URL_FOTO = 60;

function urlFotoLocal(claveFoto) {
    return claveFoto ? urlAlmacenamientoFirmada("GET", claveFoto, MINUTOS_VIGENCIA_URL_FOTO * 60).url : null;
}

/**
 * En local, el "modelo de lectura del canal público" se resuelve consultando Postgres directo
 * (sección 13). La ficha la arma `construirPerfilPublicoPorToken`, la misma que usa el proyector
 * para llenar DynamoDB en AWS; aquí solo se firma la URL de la foto al leer.
 */
export class AdaptadorLecturaPublicaPostgres {
    async getPetProfileByQrToken(tokenQr) {
        const perfil = await construirPerfilPublicoPorToken(tokenQr);
        if (!perfil) {
            return null;
        }
        const { claveFoto, ...resto } = perfil;
        return { ...resto, urlFoto: urlFotoLocal(claveFoto) };
    }
}
