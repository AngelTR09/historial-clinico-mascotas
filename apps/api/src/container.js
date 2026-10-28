import { AdaptadorNotificacionConsola } from "./adapters/local/console-notify-adapter.js";
import { AdaptadorColaEnMemoria } from "./adapters/local/in-memory-queue-adapter.js";
import { AdaptadorProyeccionEnMemoria } from "./adapters/local/in-memory-projection-adapter.js";
import { AdaptadorAutenticacionJwtLocal } from "./adapters/local/local-jwt-auth-adapter.js";
import { AdaptadorAlmacenamientoLocal } from "./adapters/local/local-storage-adapter.js";
import { AdaptadorLecturaPublicaPostgres } from "./adapters/local/postgres-public-read-adapter.js";
import { AdaptadorOcrSimulado } from "./adapters/local/stub-ocr-adapter.js";
import { config } from "./config.js";
import { INTENTOS_RECORDATORIO, TEMA_RECORDATORIO } from "./domain/temas-cola.js";
/**
 * Único lugar donde se elige la implementación local de cada puerto
 * (sección 13). Los casos de uso reciben `Puertos` por inyección; ninguno
 * importa un adaptador concreto.
 */
export function construirPuertosLocales() {
    return {
        almacenamiento: new AdaptadorAlmacenamientoLocal(),
        ocr: new AdaptadorOcrSimulado(),
        // Solo los recordatorios se reintentan: su manejador es idempotente; otros (carga masiva) no.
        cola: new AdaptadorColaEnMemoria({ maximoIntentosPorTema: { [TEMA_RECORDATORIO]: INTENTOS_RECORDATORIO } }),
        autenticacion: new AdaptadorAutenticacionJwtLocal(),
        notificacion: new AdaptadorNotificacionConsola(),
        lecturaPublica: new AdaptadorLecturaPublicaPostgres(),
        proyeccion: new AdaptadorProyeccionEnMemoria(),
    };
}
/**
 * Elige el ensamblado según `PROVEEDOR` al arrancar (nunca dentro de un caso de
 * uso). El de AWS se importa solo si se pide, para que el modo local no cargue el SDK.
 */
export async function construirPuertos() {
    if (config.PROVEEDOR === "aws") {
        const { construirPuertosAws } = await import("./container-aws.js");
        return construirPuertosAws();
    }
    return construirPuertosLocales();
}
