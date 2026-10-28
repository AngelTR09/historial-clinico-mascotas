import { CheckCircle2, CircleDashed, FileCheck } from "lucide-react";
const ESTILO_CONFIANZA = {
    declarado: { etiqueta: "No validado", className: "bg-sand/40 text-ink-soft", Icono: CircleDashed },
    con_evidencia: { etiqueta: "Con evidencia · no validado", className: "bg-pine-tint text-pine-dark", Icono: FileCheck },
    verificado: { etiqueta: "Validado por veterinario", className: "bg-gold-tint text-gold-dark", Icono: CheckCircle2 },
};
export function InsigniaConfianza({ nivel }) {
    const { etiqueta, className, Icono } = ESTILO_CONFIANZA[nivel];
    return (<span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icono className="h-3 w-3"/>
      {etiqueta}
    </span>);
}
