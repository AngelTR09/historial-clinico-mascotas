import { LogoMarca, NombreMarca } from "../ui/brand-name";
import { Link, useNavigate } from "react-router-dom";
import { limpiarTokenVeterinario } from "../../lib/auth-storage";
export function EncabezadoPaginaVeterinario({ mostrarCerrarSesion = false }) {
    const navigate = useNavigate();
    return (<header className="flex items-center justify-between border-b border-sand bg-paper-raised px-4 py-3 sm:px-6">
      <Link to="/vet/dashboard" className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
        <LogoMarca/>
        <NombreMarca/>
        <span className="text-sm font-normal text-ink-faint">· Veterinario</span>
      </Link>
      {mostrarCerrarSesion && (<button type="button" onClick={() => {
                limpiarTokenVeterinario();
                navigate("/vet");
            }} className="-mr-2 flex min-h-11 items-center px-2 text-sm text-ink-soft hover:text-ink">
          Cerrar sesión
        </button>)}
    </header>);
}
