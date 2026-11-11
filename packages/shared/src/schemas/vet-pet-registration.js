import { z } from "zod";
import { esquemaBaseCreacionDueno } from "./owner.js";
import { validarDocumento } from "./campos.js";
import { esquemaCreacionMascota } from "./pet.js";

/**
 * Alta de una mascota por un veterinario aprobado, para el dueño que aún no usa el
 * sistema. El dueño nace sin contraseña (cuenta sin activar): la reclama después
 * registrándose con el mismo documento y el mismo correo. `aceptaTratamientoDatos`
 * es la declaración del veterinario de que el dueño autorizó el tratamiento de sus
 * datos (Ley 29733).
 */
export const esquemaRegistroMascotaPorVeterinario = z.object({
    dueno: esquemaBaseCreacionDueno.omit({ contrasena: true }).superRefine((datos, ctx) => validarDocumento(datos, ctx)),
    mascota: esquemaCreacionMascota,
});
