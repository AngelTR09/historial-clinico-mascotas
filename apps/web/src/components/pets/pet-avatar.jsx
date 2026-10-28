import { PawPrint } from "lucide-react";

const TAMANOS = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-28 w-28",
};
const ICONOS = { sm: "h-6 w-6", md: "h-8 w-8", lg: "h-14 w-14" };

/** Foto circular de la mascota; sin foto muestra la huella sobre fondo pino. */
export function AvatarMascota({ urlFoto, nombre, tamano = "md", className = "" }) {
    return urlFoto ? (<img src={urlFoto} alt={`Foto de ${nombre}`} className={`${TAMANOS[tamano]} shrink-0 rounded-full object-cover ring-2 ring-paper-raised shadow-soft ${className}`}/>) : (<div className={`${TAMANOS[tamano]} flex shrink-0 items-center justify-center rounded-full bg-pine-tint ${className}`}>
      <PawPrint className={`${ICONOS[tamano]} text-pine`} aria-hidden="true"/>
    </div>);
}
