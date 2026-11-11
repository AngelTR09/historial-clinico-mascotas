import { LogoMarca, NombreMarca } from "./brand-name";
import { Link } from "react-router-dom";
import { BotonTema } from "./boton-tema";
/** Envoltorio visual compartido por las pantallas de alta (dueño y veterinario), fuera de la app autenticada. */
export function PlantillaAutenticacion({ icono: Icono, titulo, subtitulo, children, pie, imagen, altImagen = "" }) {
    return (<div className="min-h-screen bg-canvas">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 shadow-xs sm:px-6">
        <Link to="/" className="inline-flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <LogoMarca/>
          <NombreMarca/>
        </Link>
        <BotonTema/>
      </header>

      <main id="contenido" className="mx-auto flex max-w-md flex-col px-4 py-8 sm:px-6 sm:py-12">
        {imagen && <img src={imagen} alt={altImagen} width="1400" height="939" className="mb-4 h-40 w-full rounded-xl object-cover object-[50%_20%] shadow-sm sm:h-48"/>}
        <div className="rise rounded-xl border border-border bg-surface p-6 shadow-lg sm:p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pine-tint">
            <Icono className="h-6 w-6 text-pine-ink" aria-hidden="true"/>
          </div>
          <h1 className="mb-1 font-display text-3xl font-semibold text-ink">{titulo}</h1>
          <p className="mb-6 text-[15px] text-ink-soft">{subtitulo}</p>
          {children}
        </div>
        {pie && <div className="mt-6 text-center">{pie}</div>}
      </main>
    </div>);
}
