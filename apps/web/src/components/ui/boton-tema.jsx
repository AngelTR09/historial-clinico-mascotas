import { Moon, Sun } from "lucide-react";
import { useTema } from "../../hooks/use-tema";

/** Alterna entre tema claro y oscuro; la elección se recuerda (ver hooks/use-tema.js). */
export function BotonTema() {
    const { tema, alternar } = useTema();
    return (<button type="button" onClick={alternar} aria-label={tema === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-soft hover:bg-surface-sunken hover:text-ink">
      {tema === "dark" ? <Sun size={20} aria-hidden="true"/> : <Moon size={20} aria-hidden="true"/>}
    </button>);
}
