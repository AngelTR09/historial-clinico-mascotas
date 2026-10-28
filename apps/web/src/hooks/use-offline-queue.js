import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { listarSubidasPendientes, listarSubidasPendientesDeMascota } from "../lib/offline-queue";
import { sincronizarSubidasPendientes } from "../lib/offline-sync";
import { useEstadoConexion } from "./use-online-status";
async function actualizar(queryClient) {
    const resultado = await sincronizarSubidasPendientes();
    await queryClient.invalidateQueries({ queryKey: ["offline-queue"] });
    if (resultado.sincronizados > 0) {
        await queryClient.invalidateQueries({ queryKey: ["health-events"] });
    }
}
/** Cuenta y sincroniza toda la cola de subidas pendientes (uso global, p. ej. en el encabezado). */
export function useColaSinConexion() {
    const queryClient = useQueryClient();
    const enLinea = useEstadoConexion();
    const consultaPendientes = useQuery({ queryKey: ["offline-queue"], queryFn: listarSubidasPendientes });
    const sincronizar = useCallback(() => actualizar(queryClient), [queryClient]);
    const sincronizadoAlMontar = useRef(false);
    useEffect(() => {
        if (enLinea && !sincronizadoAlMontar.current) {
            sincronizadoAlMontar.current = true;
            void sincronizar();
        }
    }, [enLinea, sincronizar]);
    useEffect(() => {
        function alConectar() {
            void sincronizar();
        }
        window.addEventListener("online", alConectar);
        return () => window.removeEventListener("online", alConectar);
    }, [sincronizar]);
    return { pendientes: consultaPendientes.data ?? [], enLinea, sincronizar };
}
/** Ítems pendientes de una mascota puntual, para mostrarlos junto a su historial. */
export function useSubidasPendientesDeMascota(idMascota) {
    const consulta = useQuery({
        queryKey: ["offline-queue", idMascota],
        queryFn: () => listarSubidasPendientesDeMascota(idMascota),
        enabled: !!idMascota,
    });
    return consulta.data ?? [];
}
