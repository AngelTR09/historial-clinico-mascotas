import { AlertTriangle, CheckCircle2, CircleDashed, FileCheck } from "lucide-react";

const BASE = "inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium";

const ESTILO_CONFIANZA = {
    declarado: { etiqueta: "No validado", className: "border-border-strong bg-surface-sunken text-ink-soft", Icono: CircleDashed },
    con_evidencia: { etiqueta: "Con evidencia · no validado", className: "border-pine bg-pine-tint text-pine-ink", Icono: FileCheck },
    verificado: { etiqueta: "Validado por veterinario", className: "border-gold bg-gold-tint text-gold-ink", Icono: CheckCircle2 },
};

const ESTILO_ESTADO = {
    alerta: { className: "border-clay bg-clay-tint text-clay-ink", Icono: AlertTriangle },
    neutro: { className: "border-control-border bg-surface text-ink", Icono: null },
};

/** Nivel de confianza de un evento. Estado = ícono + palabra + borde, nunca solo color. */
export function InsigniaConfianza({ nivel }) {
    const { etiqueta, className, Icono } = ESTILO_CONFIANZA[nivel];
    return (<span className={`${BASE} ${className}`}>
      <Icono aria-hidden="true" className="h-3 w-3"/>
      {etiqueta}
    </span>);
}

/** Estado de la mascota o alerta médica: `alerta` (Extraviada) o `neutro` (Activa, Transferida). */
export function InsigniaEstado({ tono = "neutro", children }) {
    const { className, Icono } = ESTILO_ESTADO[tono];
    return (<span className={`${BASE} ${className}`}>
      {Icono && <Icono aria-hidden="true" className="h-3 w-3"/>}
      {children}
    </span>);
}

/** Punto de la línea de tiempo: repite el nivel de confianza en el borde y el tinte. */
export const PUNTO_CONFIANZA = {
    declarado: "border-control-border bg-surface text-ink-soft",
    con_evidencia: "border-pine bg-pine-tint text-pine-ink",
    verificado: "border-gold bg-gold-tint text-gold-ink",
};
