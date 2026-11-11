import { zodResolver } from "@hookform/resolvers/zod";
import { normalizarDocumento, REGLAS_DOCUMENTO } from "@hcm/shared";

/**
 * zodResolver + la regla "el formato del documento depende de su tipo". En zod esa regla cruzada
 * solo corre si los demás campos ya son válidos, y el error del DNI no aparecía hasta entonces;
 * así sale junto al campo desde el primer envío. `ruta` es "" o el objeto que contiene el
 * documento (p. ej. "dueno"). La API aplica la misma regla con el esquema compartido.
 */
export function resolverConDocumento(esquema, ruta = "") {
    const base = zodResolver(esquema);
    return async (valores, contexto, opciones) => {
        const resultado = await base(valores, contexto, opciones);
        const datos = ruta ? valores?.[ruta] : valores;
        const regla = REGLAS_DOCUMENTO[datos?.tipoDocumento];
        if (!regla || regla.patron.test(normalizarDocumento(datos?.numeroDocumento ?? ""))) {
            return resultado;
        }
        const error = { type: "custom", message: regla.mensaje };
        const errores = { ...resultado.errors };
        if (ruta) {
            errores[ruta] = { ...errores[ruta], numeroDocumento: error };
        }
        else {
            errores.numeroDocumento = error;
        }
        return { values: {}, errors: errores };
    };
}
