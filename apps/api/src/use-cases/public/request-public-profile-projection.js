import { TEMA_PROYECTOR } from "../../domain/temas-cola.js";

/**
 * Pide que el proyector reconstruya la ficha pública de la mascota. Se llama después de que la
 * escritura ya se confirmó. Nunca bloquea ni hace fallar esa escritura (RN 8): si la cola no
 * acepta el mensaje, se registra y la ficha queda desactualizada hasta el siguiente cambio.
 */
export function solicitarProyeccionPerfilPublico(ports, idMascota) {
    try {
        ports.cola.enqueue(TEMA_PROYECTOR, { idMascota });
    }
    catch (error) {
        console.error("[proyeccion] no se pudo pedir la proyección de la ficha pública:", error.message);
    }
}
