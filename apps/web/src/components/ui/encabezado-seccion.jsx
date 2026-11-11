/** Apertura de una región de página: sobretítulo, título serif, descripción y acciones. */
export function EncabezadoSeccion({ sobretitulo, titulo, descripcion, acciones, nivel: Nivel = "h1", className = "mb-6" }) {
    return (<div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border-strong pb-4 ${className}`.trim()}>
      <div className="min-w-0">
        {sobretitulo && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-pine-ink">{sobretitulo}</p>}
        <Nivel className="font-display text-3xl font-semibold text-ink">{titulo}</Nivel>
        {descripcion && <p className="mt-1 text-[15px] text-ink-soft">{descripcion}</p>}
      </div>
      {acciones}
    </div>);
}
