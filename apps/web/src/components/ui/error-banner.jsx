import { RefreshCw } from "lucide-react";
import { Aviso } from "./aviso";
/** Mensaje de error amigable para una consulta fallida, con reintento opcional. */
export function AvisoError({ mensaje = "No se pudo cargar la información. Revisa tu conexión.", alReintentar }) {
    return (<Aviso variante="peligro">
      <p>{mensaje}</p>
      {alReintentar && (<button type="button" onClick={alReintentar} className="mt-1 flex min-h-11 items-center gap-1 font-semibold underline hover:no-underline">
          <RefreshCw className="h-3.5 w-3.5"/> Reintentar
        </button>)}
    </Aviso>);
}
