import { obtenerToken } from "../lib/auth-storage";
const URL_API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
export class ErrorApi extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "ErrorApi";
    }
}
async function solicitar(ruta, opciones) {
    const token = opciones?.token !== undefined ? opciones.token : obtenerToken();
    const respuesta = await fetch(`${URL_API}${ruta}`, {
        ...opciones,
        headers: {
            ...(opciones?.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...opciones?.headers,
        },
    });
    if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => ({ error: respuesta.statusText }));
        throw new ErrorApi(cuerpo.error ?? "Error de red", respuesta.status);
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
