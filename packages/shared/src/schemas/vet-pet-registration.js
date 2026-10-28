import { z } from "zod";
import { esquemaCreacionDueno } from "./owner.js";
import { esquemaCreacionMascota } from "./pet.js";

/**
 * Alta de una mascota por un veterinario aprobado, para el dueño que aún no usa el
 * sistema. El dueño nace sin contraseña (cuenta sin activar): la reclama después
 * registrándose con el mismo documento y el mismo correo. `aceptaTratamientoDatos`
 * es la declaración del veterinario de que el dueño autorizó el tratamiento de sus
 * datos (Ley 29733).
 */
export const esquemaRegistroMascotaPorVeterinario = z.object({
    dueno: esquemaCreacionDueno.omit({ contrasena: true }),
    mascota: esquemaCreacionMascota,
});
