import { TEMA_PROYECTOR } from "../../domain/temas-cola.js";
import { construirPerfilPublicoPorIdMascota } from "./build-public-profile.js";

/**
 * Ruta alterna cuando la cola no acepta el mensaje: proyecta aquí mismo, sin pasar por el proyector.
 * Solo sirve donde hay puerto de proyección (la API); una Lambda sin él deja el aviso en el log.
 */
async function proyectarSinCola(ports, idMascota, motivo) {
    if (!ports.proyeccion) {
        console.error("[proyeccion] no se pudo pedir la proyección de la ficha pública:", motivo);
        return;
    }
    try {
        const perfil = await construirPerfilPublicoPorIdMascota(idMascota);
        if (perfil) {
            await ports.proyeccion.guardarPerfil(perfil.tokenQr, perfil);
        }
        console.warn("[proyeccion] la cola no aceptó el mensaje; la ficha se proyectó directamente:", motivo);
    }
    catch (error) {
        console.error("[proyeccion] ni la cola ni la proyección directa funcionaron; la ficha queda desactualizada hasta el siguiente cambio:", error.message);
    }
}

/**
 * Pide que el proyector reconstruya la ficha pública de la mascota. Se llama después de que la
 * escritura ya se confirmó. Nunca bloquea ni hace fallar esa escritura (RN 8).
 *
 * Devuelve una promesa que NUNCA rechaza. La API no la espera (responde de inmediato); una Lambda sí
 * debe esperarla, porque se congela al terminar y el envío a SQS quedaría a medias.
 *
 * Si la cola falla, la ficha se proyecta directamente: que el dueño marque a su mascota como
 * extraviada tiene que verse en la ficha aunque SQS no responda.
 */
export function solicitarProyeccionPerfilPublico(ports, idMascota) {
    let envio;
    try {
        envio = ports.cola.enqueue(TEMA_PROYECTOR, { idMascota });
    }
    catch (error) {
        return proyectarSinCola(ports, idMascota, error.message);
    }
    return Promise.resolve(envio).then(() => undefined, (error) => proyectarSinCola(ports, idMascota, error.message));
}
