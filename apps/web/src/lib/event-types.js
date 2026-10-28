import { TIPOS_EVENTO_SALUD } from "@hcm/shared";
const ETIQUETA_TIPO_EVENTO = {
    vacuna: "vacuna",
    chequeo: "chequeo",
    tratamiento: "tratamiento",
    desparasitacion: "desparasitación",
};
/** Texto para mostrar de un `tipo` de evento (el valor interno no lleva tilde). */
export function etiquetaTipoEvento(tipo) {
    return ETIQUETA_TIPO_EVENTO[tipo] ?? tipo;
}
export { TIPOS_EVENTO_SALUD };
