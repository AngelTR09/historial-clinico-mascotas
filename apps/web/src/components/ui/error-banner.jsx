import { AlertTriangle, RefreshCw } from "lucide-react";
/** Mensaje de error amigable para una consulta fallida, con reintento opcional. */
export function AvisoError({ mensaje = "No se pudo cargar la información. Revisa tu conexión.", alReintentar }) {
    return (<div className="flex items-start gap-2 rounded-lg border border-clay/25 bg-clay-tint p-3 text-sm text-clay-dark">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>
      <div className="flex-1">
        <p>{mensaje}</p>
        {alReintentar && (<button type="button" onClick={alReintentar} className="-ml-2 mt-1 flex min-h-11 items-center gap-1 px-2 font-medium underline hover:no-underline">
            <RefreshCw className="h-3.5 w-3.5"/> Reintentar
          </button>)}
      </div>
    </div>);
}
