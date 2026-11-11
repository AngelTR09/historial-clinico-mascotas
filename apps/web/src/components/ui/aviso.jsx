import { AlertTriangle, Info } from "lucide-react";

const VARIANTES = {
    info: { caja: "border-pine bg-pine-tint text-pine-ink", Icono: Info, rol: "status" },
    peligro: { caja: "border-clay bg-clay-tint text-clay-ink", Icono: AlertTriangle, rol: "alert" },
    neutro: { caja: "border-border-strong bg-surface-sunken text-ink", Icono: Info, rol: undefined },
    extraviada: { caja: "border-clay bg-clay text-on-clay p-4", Icono: AlertTriangle, rol: "alert" },
};

/** Mensaje en línea con ícono, título opcional y acción de recuperación. */
export function Aviso({ variante = "info", titulo, className = "", children }) {
    const { caja, Icono, rol } = VARIANTES[variante];
    return (<div role={rol} className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${caja} ${className}`.trim()}>
      <Icono aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0"/>
      <div className="min-w-0 flex-1">
        {titulo && <p className="mb-0.5 font-semibold">{titulo}</p>}
        {children}
      </div>
    </div>);
}
