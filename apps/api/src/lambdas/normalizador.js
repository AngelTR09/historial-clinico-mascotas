import { prepararEntornoTrabajador } from "./arranque.js";
import { crearManejadorSqs } from "./lambda-sqs.js";

/**
 * Lambda `normalizador` (SQS `normalizacion`): vincula el texto libre de una vacuna con el catálogo
 * canónico y pide reproyectar la ficha pública. Es el cuerpo de `workers/normalizer-worker.js`.
 */
let manejador;

async function construir() {
    await prepararEntornoTrabajador();
    const { config } = await import("../config.js");
    const { AdaptadorColaSqs } = await import("../adapters/aws/sqs-queue-adapter.js");
    const { registrarTrabajadorNormalizador } = await import("../workers/normalizer-worker.js");
    return crearManejadorSqs({
        registrar: registrarTrabajadorNormalizador,
        puertos: { cola: new AdaptadorColaSqs({ urls: { projector: config.URL_COLA_PROYECCION } }) },
    });
}

export async function handler(evento) {
    manejador ??= await construir();
    return manejador(evento);
}
