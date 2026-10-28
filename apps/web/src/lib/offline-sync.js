import { api } from "../api/client";
import { listarSubidasPendientes, marcarErrorSubidaPendiente, eliminarSubidaPendiente } from "./offline-queue";
function esErrorDeRed(err) {
    return err instanceof TypeError;
}
/**
 * Reintenta la cola de subidas pendientes en orden de creación. Los
 * eventos de salud van antes que sus adjuntos porque un adjunto necesita
 * el `idEvento` real que devuelve el backend al crear el evento. Si un
 * ítem falla por falta de red se detiene ahí (seguimos sin conexión); si
 * falla por otra razón (p. ej. validación) se marca el error y se sigue
 * con el resto para no bloquear la cola entera por un ítem inválido.
 */
export async function sincronizarSubidasPendientes() {
    const items = await listarSubidasPendientes();
    let sincronizados = 0;
    let fallidos = 0;
    for (const item of items) {
        try {
            if (item.clase === "evento-salud") {
                await api.post("/health-events", item.datos);
            }
            else {
                const { clave, url } = await api.post("/attachments/upload-url", {
                    idEvento: item.idEvento,
                    mime: item.mime,
                });
                await api.putRaw(url, item.archivo);
                await api.post("/attachments", { idEvento: item.idEvento, claveS3: clave, mime: item.mime, tamanoBytes: item.tamanoBytes });
            }
            await eliminarSubidaPendiente(item.id);
            sincronizados++;
        }
        catch (err) {
            if (esErrorDeRed(err)) {
                break;
            }
            await marcarErrorSubidaPendiente(item.id, err instanceof Error ? err.message : "Error desconocido");
            fallidos++;
        }
    }
    return { sincronizados, fallidos };
}
