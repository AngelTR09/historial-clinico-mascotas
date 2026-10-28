import { z } from "zod";
export const esquemaId = z.string().uuid();
export const esquemaClaveIdempotencia = z.string().uuid();
export const esquemaFechaHoraIso = z.string().datetime({ offset: true });
export const esquemaFechaIso = z.string().date();
export const esquemaTextoNoVacio = z.string().trim().min(1);
export const esquemaUbigeo = z.string().regex(/^\d{6}$/, "El ubigeo debe tener 6 dígitos");
/**
 * Envuelve un schema opcional para un campo de texto que puede llegar de
 * un <input> HTML sin tocar: el DOM manda "" (cadena vacía), nunca
 * `undefined`, y `.optional()` de zod solo exime a `undefined` — sin este
 * preprocess, dejar un campo "opcional" en blanco falla la validación en
 * silencio (ningún mensaje de error se renderiza para ese campo) en vez
 * de tratarse como ausente.
 */
export function textoOpcional(esquema) {
    return z.preprocess((valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor), esquema);
}

const PATRON_CORREO = /[^\s@]+@[^\s@]+/;
// 7 o más dígitos aunque estén separados por espacios, guiones, puntos o paréntesis ("999 888 777").
const PATRON_SECUENCIA_TELEFONICA = /\d(?:[\s.\-()]*\d){6,}/;
/**
 * RN 5: el canal público no expone datos personales. Los textos libres que
 * el dueño escribe para la ficha pública no pueden traer un correo ni algo
 * que parezca un teléfono (7 o más dígitos).
 */
export function textoSinDatosPersonales(texto) {
    return !PATRON_CORREO.test(texto) && !PATRON_SECUENCIA_TELEFONICA.test(texto);
}
export const MENSAJE_TEXTO_CON_DATOS_PERSONALES = "No pongas teléfono ni correo: el contacto se hace por el formulario de la ficha";
/**
 * Texto libre opcional y nullable para la ficha pública. `undefined` significa
 * "no tocar"; `null` (o cadena vacía del formulario) significa "borrar el dato".
 */
export function textoPublicoEditable(maximo) {
    return z.preprocess((valor) => (typeof valor === "string" && valor.trim() === "" ? null : valor), z
        .string()
        .trim()
        .max(maximo, `Máximo ${maximo} caracteres`)
        .refine(textoSinDatosPersonales, MENSAJE_TEXTO_CON_DATOS_PERSONALES)
        .nullable()
        .optional());
}

/**
 * Misma política que el pool de Cognito (AWS-hcm/infra/modules/identidad): al migrar a Cognito
 * ninguna contraseña válida hoy deja de serlo. Mínimo 12 caracteres con minúscula, mayúscula,
 * número y símbolo. El máximo evita pagar el costo del hash por entradas gigantes.
 */
export const esquemaContrasena = z
    .string()
    .min(12, "Usa al menos 12 caracteres")
    .max(128, "Usa como máximo 128 caracteres")
    .regex(/[a-z]/, "Incluye una minúscula")
    .regex(/[A-Z]/, "Incluye una mayúscula")
    .regex(/[0-9]/, "Incluye un número")
    .regex(/[^A-Za-z0-9]/, "Incluye un símbolo");
