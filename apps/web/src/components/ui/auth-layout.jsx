import { LogoMarca, NombreMarca } from "./brand-name";
import { Link } from "react-router-dom";
/** Envoltorio visual compartido por las pantallas de alta (dueño y veterinario), fuera de la app autenticada. */
export function PlantillaAutenticacion({ icono: Icono, titulo, subtitulo, children, pie, imagen, altImagen = "" }) {
    return (<div className="min-h-screen bg-paper">
      <header className="px-4 py-4 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <LogoMarca/>
          <NombreMarca/>
        </Link>
      </header>

      <main id="contenido" className="mx-auto flex max-w-md flex-col px-4 py-6 sm:px-6 sm:py-10">
        {imagen && <img src={imagen} alt={altImagen} width="1400" height="939" className="mb-4 h-40 w-full rounded-2xl object-cover object-[50%_20%] shadow-soft sm:h-48"/>}
        <div className="rise rounded-2xl border border-sand bg-paper-raised p-6 shadow-[var(--shadow-lift)] sm:p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pine-tint">
            <Icono className="h-6 w-6 text-pine"/>
          </div>
          <h1 className="mb-1 font-display text-2xl font-semibold text-ink">{titulo}</h1>
          <p className="mb-6 text-sm text-ink-soft">{subtitulo}</p>
          {children}
        </div>
        {pie && <div className="mt-6 text-center">{pie}</div>}
      </main>
    </div>);
}
