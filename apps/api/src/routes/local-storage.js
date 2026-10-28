import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { firmaAlmacenamientoValida } from "../adapters/local/local-storage-signature.js";
import { ErrorNoEncontrado, ErrorProhibido } from "../domain/errors.js";
const TIPO_POR_EXTENSION = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const esquemaParametros = z.object({ "*": z.string().min(1) });
const esquemaFirma = z.object({ expires: z.string().optional(), sig: z.string().optional() });
function exigirFirma(request, metodo, key) {
    const { expires, sig } = esquemaFirma.parse(request.query);
    if (!firmaAlmacenamientoValida(metodo, key, expires, sig)) {
        throw new ErrorProhibido("La URL de almacenamiento no es válida o ya expiró");
    }
}
function resolverRutaGuardada(key) {
    const resuelta = path.resolve(config.STORAGE_LOCAL_PATH, key);
    const raiz = path.resolve(config.STORAGE_LOCAL_PATH);
    if (!resuelta.startsWith(raiz + path.sep)) {
        throw new ErrorNoEncontrado("Clave de almacenamiento inválida");
    }
    return resuelta;
}
/**
 * Emulador local de un bucket S3 con presigned URLs (sección 13:
 * `PuertoAlmacenamiento` local). Solo existe para desarrollo; en la nube esta
 * ruta desaparece y el cliente sube directo a S3.
 */
export async function rutasAlmacenamientoLocal(app) {
    app.put("/local-storage/*", async (request, reply) => {
        const { "*": key } = esquemaParametros.parse(request.params);
        exigirFirma(request, "PUT", key);
        const rutaArchivo = resolverRutaGuardada(key);
        await mkdir(path.dirname(rutaArchivo), { recursive: true });
        await writeFile(rutaArchivo, request.body);
        reply.code(204);
    });
    app.get("/local-storage/*", async (request, reply) => {
        const { "*": key } = esquemaParametros.parse(request.params);
        exigirFirma(request, "GET", key);
        const rutaArchivo = resolverRutaGuardada(key);
        try {
            const contenido = await readFile(rutaArchivo);
            const tipo = TIPO_POR_EXTENSION[path.extname(key).toLowerCase()];
            if (tipo) {
                reply.type(tipo);
            }
            reply.send(contenido);
        }
        catch {
            throw new ErrorNoEncontrado("Archivo no encontrado");
        }
    });
}
