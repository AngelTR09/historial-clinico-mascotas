import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

const CLASE_INPUT = "w-full min-h-11 rounded-md border border-sand-dark pl-3 pr-11 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

/**
 * Campo de contraseña con un botón para verla u ocultarla. Recibe lo mismo que un
 * `<input>` (incluido lo que devuelve `register` de react-hook-form).
 */
export const CampoContrasenaVisible = forwardRef(function CampoContrasenaVisible(props, ref) {
    const [visible, setVisible] = useState(false);
    return (<div className="relative">
      <input ref={ref} type={visible ? "text" : "password"} className={CLASE_INPUT} {...props}/>
      <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-ink-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-pine/40">
        {visible ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
      </button>
    </div>);
});
