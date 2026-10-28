import { ErrorDemasiadasSolicitudes } from "../domain/errors.js";
const VENTANA_MS = 60_000;
const MAXIMO_VENTANAS_EN_MEMORIA = 10_000;
/**
 * Dos grupos con presupuesto propio por IP: el inicio de sesión (`/auth/*`) y el alta de cuentas
 * (`POST /owners` y `POST /vets`). Ambos son públicos y mandan un correo, así que sin tope sirven para
 * llenar de códigos el buzón de un tercero o para adivinar contraseñas repartiendo los intentos entre
 * cuentas (el bloqueo por cuenta solo frena los intentos contra una misma cuenta).
 */
function grupoDe(request) {
    const ruta = request.url.split("?")[0];
    if (ruta.startsWith("/auth/")) return "auth";
    if (request.method === "POST" && (ruta === "/owners" || ruta === "/vets")) return "alta";
    return null;
}
/**
 * Ventana fija de un minuto, en memoria del proceso: con varias tareas cada una cuenta aparte, así que el
 * tope real es de `maximoPorMinuto` por tarea. Es una defensa de profundidad, no la barrera principal: en
 * AWS las reglas de tasa de WAF o Cognito hacen ese trabajo para toda la flota.
 */
export function registrarLimiteDeSolicitudes(app, { maximoPorMinuto, ahora = Date.now }) {
    const ventanas = new Map();
    function podar(instante) {
        for (const [clave, ventana] of ventanas) {
            if (instante - ventana.empieza >= VENTANA_MS) ventanas.delete(clave);
        }
    }
    app.addHook("onRequest", async (request, reply) => {
        const grupo = grupoDe(request);
        if (!grupo) return;
        const instante = ahora();
        const clave = `${request.ip}|${grupo}`;
        let ventana = ventanas.get(clave);
        if (!ventana || instante - ventana.empieza >= VENTANA_MS) {
            ventana = { empieza: instante, cuenta: 0 };
            ventanas.set(clave, ventana);
            if (ventanas.size > MAXIMO_VENTANAS_EN_MEMORIA) podar(instante);
        }
        ventana.cuenta += 1;
        if (ventana.cuenta > maximoPorMinuto) {
            reply.header("Retry-After", String(Math.max(1, Math.ceil((ventana.empieza + VENTANA_MS - instante) / 1000))));
            throw new ErrorDemasiadasSolicitudes();
        }
    });
}
