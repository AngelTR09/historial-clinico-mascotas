import { CloudOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useColaSinConexion } from "../../hooks/use-offline-queue";
export function AvisoColaSinConexion() {
    const { pendientes, enLinea, sincronizar } = useColaSinConexion();
    const [sincronizando, setSincronizando] = useState(false);
    if (enLinea && pendientes.length === 0) {
        return null;
    }
    async function manejarSincronizacion() {
        setSincronizando(true);
        try {
            await sincronizar();
        }
        finally {
            setSincronizando(false);
        }
    }
    return (<div className="border-b border-gold/25 bg-gold-tint px-4 py-2 text-sm text-gold-dark sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5">
          <CloudOff className="h-4 w-4 shrink-0"/>
          {!enLinea && "Sin conexión. "}
          {pendientes.length > 0 && `${pendientes.length} registro(s) pendiente(s) de sincronizar.`}
        </span>
        {enLinea && pendientes.length > 0 && (<button type="button" onClick={() => void manejarSincronizacion()} disabled={sincronizando} className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 underline hover:no-underline disabled:opacity-50 sm:self-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? "animate-spin" : ""}`}/>
            {sincronizando ? "Sincronizando..." : "Sincronizar ahora"}
          </button>)}
      </div>
    </div>);
}
