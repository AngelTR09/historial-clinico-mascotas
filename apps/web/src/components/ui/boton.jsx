import { forwardRef } from "react";

const BASE = "inline-flex items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

const VARIANTES = {
    primaria: "border-transparent bg-pine text-on-pine shadow-xs hover:bg-pine-hover",
    secundaria: "border-control-border bg-surface text-ink shadow-xs hover:border-ink-soft hover:bg-surface-sunken",
    fantasma: "border-transparent bg-transparent text-pine-ink hover:bg-pine-tint",
    peligro: "border-transparent bg-clay text-on-clay shadow-xs hover:brightness-90",
};

const TAMANOS = {
    sm: "min-h-9 px-3 text-sm",
    md: "min-h-11 px-4 text-[15px]",
    lg: "min-h-12 px-6 text-[15px]",
};

/**
 * Clases de un botón del sistema de diseño v2. Sirve para `<Link>` y `<label>`
 * además de `<button>`. `bloque`: true = ancho completo; "movil" = ancho completo
 * bajo 640px (el envío de formularios) y ancho automático desde ahí.
 */
export function claseBoton({ variante = "primaria", tamano = "md", bloque = false, extra = "" } = {}) {
    const ancho = bloque === "movil" ? "w-full sm:w-auto" : bloque ? "w-full" : "";
    return [BASE, VARIANTES[variante], TAMANOS[tamano], ancho, extra].filter(Boolean).join(" ");
}

/** Botón: una sola acción primaria por vista; el resto va como secundaria o fantasma. */
export const Boton = forwardRef(function Boton({ variante, tamano, bloque, cargando = false, disabled, className = "", children, type = "button", ...resto }, ref) {
    return (<button ref={ref} type={type} disabled={disabled || cargando} aria-busy={cargando || undefined} className={claseBoton({ variante, tamano, bloque, extra: className })} {...resto}>
      {cargando && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"/>}
      {children}
    </button>);
});
