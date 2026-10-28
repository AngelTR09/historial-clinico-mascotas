import { z } from "zod";
import { INTENTOS_MAXIMOS_CODIGO, ROLES_SESION } from "../constants.js";

export const rolSesionSchema = z.enum(ROLES_SESION);

const correo = z.string().trim().toLowerCase().email();

/** Inicio de sesión (RNF 03 y 06). La contraseña no se vuelve a validar aquí: solo se compara. */
export const esquemaInicioSesion = z.object({
    rol: rolSesionSchema,
    correo,
    contrasena: z.string().min(1).max(128),
});

/** Código de 6 dígitos que llegó al correo al registrarse. */
export const esquemaVerificacionCorreo = z.object({
    rol: rolSesionSchema,
    correo,
    codigo: z.string().regex(/^\d{6}$/, "El código tiene 6 dígitos"),
});

export const esquemaReenvioCodigo = z.object({
    rol: rolSesionSchema,
    correo,
});

export { INTENTOS_MAXIMOS_CODIGO };
