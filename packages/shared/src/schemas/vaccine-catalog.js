import { z } from "zod";
import { esquemaId, esquemaTextoNoVacio } from "./primitives.js";
/**
 * Entrada curada del catálogo canónico de vacunas. No tiene esquema de
 * creación por API en esta fase: la curaduría llena `curation_queue` y
 * un proceso interno decide si nace una entrada nueva aquí.
 */
export const esquemaCatalogoVacunas = z.object({
    id: esquemaId,
    nombreCanonico: esquemaTextoNoVacio,
    especie: esquemaTextoNoVacio,
    mesesVigencia: z.number().int().positive(),
    intervaloRefuerzoDias: z.number().int().positive().nullable(),
    activo: z.boolean(),
});
