import { prepararEntornoTrabajador } from "./arranque.js";
import { crearManejadorSqs } from "./lambda-sqs.js";

/**
 * Lambda `proyector` (SQS `proyeccion`): reconstruye la ficha pública desde Postgres y la escribe
 * en DynamoDB. Es el cuerpo de `workers/projector-worker.js`; aquí solo se ensambla.
 *
 * También acepta una invocación manual para proyectar las mascotas que existían antes del proyector:
 *   aws lambda invoke --function-name hcm-proyector --cli-binary-format raw-in-base64-out \
 *     --payload '{"accion":"reconstruir-todo"}' salida.json
 * Responde `{ encolados, fallidos, siguiente }`; si `siguiente` no es null se vuelve a invocar con
 * `{"accion":"reconstruir-todo","despues":"<siguiente>"}` hasta que sea null.
 * El manejador se arma en el arranque en frío y se reutiliza entre invocaciones.
 */
let componentes;

async function construir() {
    await prepararEntornoTrabajador();
    const { config } = await import("../config.js");
    const { AdaptadorProyeccionDynamoDb } = await import("../adapters/aws/dynamodb-projection-adapter.js");
    const { AdaptadorColaSqs } = await import("../adapters/aws/sqs-queue-adapter.js");
    const { registrarTrabajadorProyector } = await import("../workers/projector-worker.js");
    const { reconstruirProyeccionesDentroDelTiempo } = await import("../workers/projection-rebuild.js");
    const cola = new AdaptadorColaSqs({ urls: { projector: config.URL_COLA_PROYECCION } });
    return {
        atenderSqs: crearManejadorSqs({
            registrar: registrarTrabajadorProyector,
            puertos: { proyeccion: new AdaptadorProyeccionDynamoDb({ tabla: config.TABLA_PERFIL_PUBLICO }) },
        }),
        reconstruirTodo: (despues, contexto) => reconstruirProyeccionesDentroDelTiempo({ cola }, { despues, milisegundosRestantes: () => contexto.getRemainingTimeInMillis() }),
    };
}

export async function handler(evento, contexto) {
    componentes ??= await construir();
    if (evento?.accion === "reconstruir-todo") {
        return componentes.reconstruirTodo(evento.despues ?? null, contexto);
    }
    return componentes.atenderSqs(evento);
}
