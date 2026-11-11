import { z } from "zod";
import { INTENTOS_MAXIMOS_CODIGO, ROLES_SESION } from "../constants.js";
import { esquemaCorreo, LIMITES, tieneCaracterDeControl } from "./campos.js";

export const rolSesionSchema = z.enum(ROLES_SESION);

const correo = esquemaCorreo;

/** Contraseña de entrada: no se vuelve a exigir la política (solo se compara), pero se acota y se limpia. */
const contrasenaDeEntrada = z
    .string()
    .min(1, "Escribe tu contraseña")
    .max(LIMITES.contrasena, `Usa como máximo ${LIMITES.contrasena} caracteres`)
    .refine((valor) => !tieneCaracterDeControl(valor), "La contraseña tiene caracteres no permitidos");

/** Inicio de sesión (RNF 03 y 06). La contraseña no se vuelve a validar aquí: solo se compara. */
export const esquemaInicioSesion = z.object({
    // Opcional: sin `rol` el servidor decide por la cuenta (dueño o veterinario) que coincide con el correo y la contraseña.
    rol: rolSesionSchema.optional(),
    correo,
    contrasena: contrasenaDeEntrada,
});

/**
 * Código de 6 dígitos que llegó al correo al registrarse. `contrasena` solo la exige el servidor cuando la
 * cuenta la creó un veterinario y el dueño la está reclamando: es la que eligió en ese registro.
 */
export const esquemaVerificacionCorreo = z.object({
    rol: rolSesionSchema,
    correo,
    codigo: z.string().regex(/^\d{6}$/, "El código tiene 6 dígitos"),
    contrasena: z.string().min(1).max(128).optional(),
});

export const esquemaReenvioCodigo = z.object({
    rol: rolSesionSchema,
    correo,
});

export { INTENTOS_MAXIMOS_CODIGO };
