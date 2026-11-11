/** Filas placeholder mientras carga una lista (mascotas, eventos). */
export function EsqueletoLista({ filas = 3 }) {
    return (<div className="space-y-3" aria-hidden="true">
      {Array.from({ length: filas }, (_, i) => (<div key={i} className="animate-pulse rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 rounded-full bg-surface-sunken"/>
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 rounded bg-surface-sunken"/>
              <div className="h-3 w-1/2 rounded bg-surface-sunken"/>
            </div>
          </div>
        </div>))}
    </div>);
}
