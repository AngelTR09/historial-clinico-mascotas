import { LogoMarca, NombreMarca } from "./brand-name";
import { Link, useNavigate } from "react-router-dom";
import { limpiarToken } from "../../lib/auth-storage";
import { AvisoColaSinConexion } from "../offline/offline-queue-banner";
export function EncabezadoPagina({ mostrarCerrarSesion = false }) {
    const navigate = useNavigate();
    return (<>
      <header className="flex items-center justify-between sticky top-0 z-20 border-b border-sand/80 bg-paper-raised/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper-raised/70 sm:px-6">
        <Link to="/dashboard" className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <LogoMarca/>
          <NombreMarca/>
        </Link>
        {mostrarCerrarSesion && (<button type="button" onClick={() => {
                limpiarToken();
                navigate("/");
            }} className="-mr-2 flex min-h-11 items-center px-2 text-sm text-ink-soft hover:text-ink">
            Cerrar sesión
          </button>)}
      </header>
      <AvisoColaSinConexion />
    </>);
}
