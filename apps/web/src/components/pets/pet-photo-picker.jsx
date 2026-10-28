import { Camera, Image as ImagenIcono, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { AvatarMascota } from "./pet-avatar";

/**
 * Selector de foto estilo perfil de WhatsApp: círculo con una insignia de cámara que
 * abre dos opciones — "Tomar foto" (en el celular abre la cámara trasera directamente
 * gracias a `capture`) y "Elegir de la galería". No sube nada: entrega el `File` elegido
 * a `alElegir`, quien decide cuándo subirlo (al registrar o de inmediato).
 */
export function SelectorFotoMascota({ urlFoto, nombre = "tu mascota", alElegir, ocupado = false, error = null, tamano = "lg" }) {
    const [abierto, setAbierto] = useState(false);
    const idCamara = useId();
    const idGaleria = useId();
    function alCambiar(evento) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";
        setAbierto(false);
        if (archivo) {
            alElegir(archivo);
        }
    }
    return (<div className="relative inline-flex flex-col items-center">
      <button type="button" onClick={() => setAbierto((v) => !v)} disabled={ocupado} aria-expanded={abierto} aria-label={urlFoto ? `Cambiar la foto de ${nombre}` : `Agregar una foto de ${nombre}`} className="group relative rounded-full disabled:cursor-wait">
        <AvatarMascota urlFoto={urlFoto} nombre={nombre} tamano={tamano}/>
        <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-pine text-white shadow-[var(--shadow-lift)] ring-2 ring-paper-raised group-hover:bg-pine-dark">
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin"/> : <Camera className="h-4 w-4"/>}
        </span>
      </button>

      {abierto && (<div role="menu" className="rise absolute left-1/2 top-full z-30 mt-3 w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-sand bg-paper-raised shadow-[var(--shadow-lift)]">
          <label htmlFor={idCamara} role="menuitem" className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-ink hover:bg-pine-tint">
            <Camera className="h-4 w-4 text-pine"/> Tomar foto
          </label>
          <label htmlFor={idGaleria} role="menuitem" className="flex min-h-11 cursor-pointer items-center gap-2 border-t border-sand px-3 text-sm text-ink hover:bg-pine-tint">
            <ImagenIcono className="h-4 w-4 text-pine"/> Elegir de la galería
          </label>
        </div>)}

      <input id={idCamara} type="file" accept="image/*" capture="environment" className="sr-only" onChange={alCambiar} aria-label="Tomar foto con la cámara"/>
      <input id={idGaleria} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={alCambiar} aria-label="Elegir foto de la galería"/>

      {error && <p role="alert" className="mt-2 max-w-56 text-center text-xs text-clay-dark">{error}</p>}
    </div>);
}
