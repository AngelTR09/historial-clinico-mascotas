const TONOS = {
    neutro: "border-border bg-surface",
    verificado: "border-border bg-surface",
    alerta: "border-border bg-surface",
    hundido: "border-border bg-surface-sunken shadow-none",
};

const CABECERA_TONO = {
    neutro: "bg-surface-sunken text-ink border-border",
    verificado: "bg-gold-tint text-gold-ink border-gold",
    alerta: "bg-clay-tint text-clay-ink border-clay",
    hundido: "bg-surface-sunken text-ink border-border",
};

/** Contenedor de una función de la pantalla (identidad, historial, acciones, alertas). */
export function Panel({ tono = "neutro", className = "", children, ...resto }) {
    return (<section data-tono={tono} className={`overflow-hidden rounded-lg border shadow-xs ${TONOS[tono]} ${className}`.trim()} {...resto}>
      {children}
    </section>);
}

/** Franja superior hundida con el título del panel y, opcional, una acción a la derecha. */
export function PanelCabecera({ titulo, tono = "neutro", acciones, children }) {
    return (<header className={`flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 ${CABECERA_TONO[tono]}`}>
      {titulo ? <h2 className="font-sans text-lg font-semibold">{titulo}</h2> : children}
      {acciones}
    </header>);
}

export function PanelCuerpo({ className = "", children }) {
    return <div className={`p-4 sm:p-5 ${className}`.trim()}>{children}</div>;
}

/** Barra inferior hundida para las acciones del panel. */
export function PanelPie({ children }) {
    return <footer className="flex flex-wrap justify-end gap-3 border-t border-border bg-surface-sunken px-4 py-3 sm:px-5">{children}</footer>;
}
