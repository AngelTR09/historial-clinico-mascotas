import { LogoMarca, NombreMarca } from "../ui/brand-name";
import { Link, useNavigate } from "react-router-dom";
import { limpiarTokenVeterinario } from "../../lib/auth-storage";
import { BotonTema } from "../ui/boton-tema";
export function EncabezadoPaginaVeterinario({ mostrarCerrarSesion = false }) {
    const navigate = useNavigate();
    return (<header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface px-4 shadow-xs sm:px-6">
      <Link to="/vet/dashboard" className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
        <LogoMarca/>
        <NombreMarca/>
        <span className="text-sm font-normal text-ink-soft">· Veterinario</span>
      </Link>
      <div className="flex items-center gap-1">
      <BotonTema/>
      {mostrarCerrarSesion && (<button type="button" onClick={() => {
                limpiarTokenVeterinario();
                navigate("/vet");
            }} className="flex min-h-11 items-center rounded-md px-3 text-sm text-ink-soft hover:bg-surface-sunken hover:text-ink">
          Cerrar sesión
        </button>)}
      </div>
    </header>);
}
