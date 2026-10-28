/**
 * Texto de cada correo que envía el sistema, por `template` de `NotifyPort`. Vive en el dominio
 * y no en el adaptador para que se pruebe sin AWS y no cambie si el proveedor de correo cambia.
 * Nunca incluye el documento, la dirección ni el teléfono del dueño (RN 5).
 */
export class ErrorPlantillaDesconocida extends Error {
    constructor(plantilla) {
        super(`No existe una plantilla de correo para "${plantilla}"`);
        this.name = "ErrorPlantillaDesconocida";
    }
}

const PLANTILLAS = {
    codigo_verificacion: ({ codigo, minutosVigencia }) => ({
        asunto: "Tu código de verificación",
        cuerpo: `Tu código es ${codigo}. Vence en ${minutosVigencia} minutos.\n\nSi no lo pediste, ignora este mensaje.`,
    }),
    recordatorio_vencimiento_vacuna: ({ nombreMascota, vacuna, vencimiento, tipo }) => tipo === "desparasitacion"
        ? {
            asunto: `Desparasitación por vencer: ${nombreMascota}`,
            cuerpo: `La desparasitación de ${nombreMascota} vence el ${vencimiento}.\n\nAgenda la siguiente con tu veterinario.`,
        }
        : {
            asunto: `Vacuna por vencer: ${nombreMascota}`,
            cuerpo: `La vacuna "${vacuna}" de ${nombreMascota} vence el ${vencimiento}.\n\nAgenda su refuerzo con tu veterinario.`,
        },
    carga_masiva_completada: ({ total, exitosas, fallidas }) => ({
        asunto: "Tu carga masiva terminó",
        cuerpo: `Se procesaron ${total} mascotas: ${exitosas} registradas y ${fallidas} con error.`,
    }),
    contacto_mascota_perdida: ({ nombreMascota, nombreContacto, canalContacto, mensaje }) => ({
        asunto: `Alguien encontró a ${nombreMascota}`,
        cuerpo: `${nombreContacto} escribió desde la ficha pública de ${nombreMascota}:\n\n${mensaje}\n\nPuedes responderle por: ${canalContacto}\n\nTus datos de contacto no se compartieron.`,
    }),
};

/** Devuelve `{ asunto, cuerpo }` o lanza `ErrorPlantillaDesconocida` si el `template` no existe. */
export function renderizarCorreo(plantilla, datos = {}) {
    const construir = PLANTILLAS[plantilla];
    if (!construir) {
        throw new ErrorPlantillaDesconocida(plantilla);
    }
    return construir(datos);
}
