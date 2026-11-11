import { Download } from "lucide-react";
import { claseBoton } from "../ui/boton";

/**
 * Código público con su dígito verificador y la placa QR (IdentityTag del sistema de diseño).
 * El QR codifica solo la URL con el token opaco, nunca el código (RN 1): el aviso es obligatorio.
 * El QR va siempre sobre blanco para que cualquier lector lo vea, también en tema oscuro.
 */
export function EtiquetaIdentidad({ codigoPublico, nombre, urlImagenQr, alDescargar, vertical = false }) {
    const base = codigoPublico.slice(0, -1);
    const verificador = codigoPublico.slice(-1);
    return (<div className={`flex flex-col items-center gap-4 ${vertical ? "" : "sm:flex-row sm:items-center sm:gap-5"}`}>
      <img src={urlImagenQr} alt={`Código QR de la placa de ${nombre}`} width="160" height="160" className="h-32 w-32 shrink-0 rounded-md border border-border-strong bg-white p-2"/>
      <div className={vertical ? "text-center" : "text-center sm:text-left"}>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Código de la mascota</p>
        <p className="my-1 font-mono text-xl font-medium tracking-[0.12em] text-ink">
          {base}
          <span className="text-gold-ink" title="Dígito verificador">-{verificador}</span>
        </p>
        <p className="text-sm text-ink-soft">El QR de la placa no contiene este código. Muéstralo al veterinario para abrir el expediente.</p>
        <button type="button" onClick={alDescargar} className={claseBoton({ variante: "secundaria", tamano: "sm", extra: "mt-3" })}>
          <Download className="h-4 w-4" aria-hidden="true"/> Descargar para láser (SVG)
        </button>
      </div>
    </div>);
}
