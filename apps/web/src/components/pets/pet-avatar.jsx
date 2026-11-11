import { PawPrint } from "lucide-react";
import { useState } from "react";

const TAMANOS = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-28 w-28",
};
const ICONOS = { sm: "h-6 w-6", md: "h-8 w-8", lg: "h-14 w-14" };

/** Foto circular de la mascota; sin foto (o si no carga) muestra la huella sobre fondo pino. */
export function AvatarMascota({ urlFoto, nombre, tamano = "md", className = "" }) {
    // Se recuerda la URL que falló, no un booleano: si el dueño sube otra foto se vuelve a intentar sola.
    const [urlRota, setUrlRota] = useState(null);
    return urlFoto && urlFoto !== urlRota ? (<img src={urlFoto} alt={`Foto de ${nombre}`} onError={() => setUrlRota(urlFoto)} className={`${TAMANOS[tamano]} shrink-0 rounded-full object-cover ring-2 ring-surface shadow-sm ${className}`}/>) : (<div className={`${TAMANOS[tamano]} flex shrink-0 items-center justify-center rounded-full bg-pine-tint ${className}`}>
      <PawPrint className={`${ICONOS[tamano]} text-pine`} aria-hidden="true"/>
    </div>);
}
