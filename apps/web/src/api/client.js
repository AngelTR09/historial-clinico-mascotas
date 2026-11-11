import { obtenerToken } from "../lib/auth-storage";
const URL_API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
export class ErrorApi extends Error {
    status;
    datos;
    constructor(message, status, datos) {
        super(message);
        this.status = status;
        this.datos = datos;
        this.name = "ErrorApi";
    }
}
// Una API que no contesta no debe dejar la pantalla esperando sin fin (base en failover, tarea colgada).
const MILISEGUNDOS_MAXIMOS_DE_ESPERA = 20_000;
const ESTADOS_TRANSITORIOS = new Set([429, 502, 503, 504]);
/**
 * El fallo es pasajero y la operación no se aplicó: sin red, la API tardó demasiado, o respondió que no
 * está disponible (503 mientras la base se recupera, 502/504 del balanceador, 429 por el tope de
 * solicitudes). Lo correcto es conservar lo capturado y reintentar después con la misma clave de
 * idempotencia. Un 4xx de validación o un 500 no entran: reintentarlos daría el mismo resultado.
 */
export function esFalloTransitorio(err) {
    if (err instanceof ErrorApi) {
        return ESTADOS_TRANSITORIOS.has(err.status);
    }
    return err instanceof TypeError || err?.name === "TimeoutError" || err?.name === "AbortError";
}
async function solicitar(ruta, opciones) {
    const token = opciones?.token !== undefined ? opciones.token : obtenerToken();
    const respuesta = await fetch(`${URL_API}${ruta}`, {
        signal: AbortSignal.timeout(MILISEGUNDOS_MAXIMOS_DE_ESPERA),
        ...opciones,
        headers: {
            ...(opciones?.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...opciones?.headers,
        },
    });
    if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => ({ error: respuesta.statusText }));
        throw new ErrorApi(cuerpo.error ?? "Error de red", respuesta.status, cuerpo);
    }
    if (respuesta.status === 204) {
        return undefined;
    }
    return (await respuesta.json());
}
export const api = {
    get: (ruta, opciones) => solicitar(ruta, opciones),
    post: (ruta, cuerpo, opciones) => solicitar(ruta, { ...opciones, method: "POST", body: cuerpo ? JSON.stringify(cuerpo) : undefined }),
    put: (ruta, cuerpo, opciones) => solicitar(ruta, { ...opciones, method: "PUT", body: cuerpo ? JSON.stringify(cuerpo) : undefined }),
    patch: (ruta, cuerpo, opciones) => solicitar(ruta, { ...opciones, method: "PATCH", body: cuerpo ? JSON.stringify(cuerpo) : undefined }),
    putRaw: async (url, file) => {
        const respuesta = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!respuesta.ok) {
            throw new ErrorApi("No se pudo subir el archivo", respuesta.status);
        }
    },
};
