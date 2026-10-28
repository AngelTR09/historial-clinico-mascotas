import { TEMA_PROYECTOR } from "../domain/temas-cola.js";
import { construirPerfilPublicoPorIdMascota } from "../use-cases/public/build-public-profile.js";

/**
 * Consumidor del tema 'projector' (PuertoCola): reconstruye la ficha pública de la mascota
 * desde Postgres y la escribe por `ProjectionPort` (en AWS, DynamoDB), para que la ficha por QR
 * siga respondiendo aunque Postgres esté caído o en failover. En la nube este mismo cuerpo corre
 * como la Lambda `proyector`, alimentada por SQS.
 *
 * Es idempotente: reconstruye siempre desde el estado actual, así que repetir un mensaje o
 * procesarlos desordenados converge al mismo resultado.
 */
export function registrarTrabajadorProyector(ports) {
    ports.cola.subscribe(TEMA_PROYECTOR, async ({ idMascota }) => {
        const perfil = await construirPerfilPublicoPorIdMascota(idMascota);
        if (!perfil) {
            return;
        }
        await ports.proyeccion.guardarPerfil(perfil.tokenQr, perfil);
    });
}
