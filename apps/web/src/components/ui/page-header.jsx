import { BotonTema } from "./boton-tema";
import { LogoMarca, NombreMarca } from "./brand-name";
import { Link, useNavigate } from "react-router-dom";
import { limpiarToken } from "../../lib/auth-storage";
import { AvisoColaSinConexion } from "../offline/offline-queue-banner";
export function EncabezadoPagina({ mostrarCerrarSesion = false }) {
    const navigate = useNavigate();
    return (<>
      <header className="flex items-center justify-between sticky top-0 z-20 border-b border-border bg-surface px-4 shadow-xs sm:px-6 h-16">
        <Link to="/dashboard" className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <LogoMarca/>
          <NombreMarca/>
        </Link>
        <div className="flex items-center gap-1">
        <BotonTema/>
        {mostrarCerrarSesion && (<button type="button" onClick={() => {
                limpiarToken();
                navigate("/");
            }} className="flex min-h-11 items-center rounded-md px-3 text-sm text-ink-soft hover:bg-surface-sunken hover:text-ink">
            Cerrar sesión
          </button>)}
        </div>
      </header>
      <AvisoColaSinConexion />
    </>);
}
