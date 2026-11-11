import { AlertTriangle, ArrowRightLeft, Check, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { AvatarMascota } from "./pet-avatar";
import { EtiquetaIdentidad } from "./identity-tag";
import { claseBoton } from "../ui/boton";
import { InsigniaEstado } from "../ui/confidence-badge";

const CLASE_ICONO = "flex h-11 w-11 items-center justify-center rounded-md text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-50";

/**
 * Tarjeta de una mascota en el dashboard (PetCard del sistema de diseño): identidad arriba,
 * barra hundida abajo con las acciones. Toda la lógica (mutaciones, copiado) llega por props.
 * Una sola insignia: extraviada gana sobre cualquier otro estado.
 */
export function TarjetaMascota({ mascota, indice, qrVisible, transferenciaVisible, tokenCopiado, estadoOcupado, transferenciaOcupada, codigoTransferencia, errorTransferencia, transferenciaCopiada, urlFicha, urlImagenQr, alCambiarEstado, alCopiarToken, alAlternarQr, alDescargarQr, alTransferir, alReemplazarTransferencia, alCopiarTransferencia }) {
    const extraviada = mascota.estado === "extraviada";
    return (<article style={{ "--i": indice }} className="lift rise flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <Link to={`/pets/${mascota.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-sunken/60" aria-label={`Ver historial de ${mascota.nombre}`}>
        <AvatarMascota urlFoto={mascota.urlFoto} nombre={mascota.nombre} tamano="md"/>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-2xl font-semibold text-ink">{mascota.nombre}</h3>
          <p className="text-sm capitalize text-ink-soft">{mascota.especie}</p>
        </div>
        {extraviada && <InsigniaEstado tono="alerta">Extraviada</InsigniaEstado>}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle bg-surface-sunken px-4 py-2">
        <span className="rounded-sm border border-border-strong bg-surface px-2 py-0.5 font-mono text-sm tracking-wider text-ink">{mascota.codigoPublico}</span>
        <div className="flex items-center">
          <button type="button" onClick={alCopiarToken} title="Copiar código QR (para que un veterinario lo escanee o pegue en su panel)" aria-label={`Copiar el código QR de ${mascota.nombre}`} className={CLASE_ICONO}>
            {tokenCopiado ? <Check className="h-4 w-4" aria-hidden="true"/> : <Copy className="h-4 w-4" aria-hidden="true"/>}
          </button>
          <button type="button" onClick={alAlternarQr} aria-expanded={qrVisible} title="Ver placa QR" aria-label={`Ver placa QR de ${mascota.nombre}`} className={`${CLASE_ICONO} ${qrVisible ? "bg-pine-tint text-pine-ink" : ""}`}>
            <QrCode className="h-4 w-4" aria-hidden="true"/>
          </button>
          <button type="button" onClick={alDescargarQr} title="Descargar la placa QR en SVG, lista para grabar con láser" aria-label={`Descargar placa QR de ${mascota.nombre}`} className={CLASE_ICONO}>
            <Download className="h-4 w-4" aria-hidden="true"/>
          </button>
          <Link to={urlFicha} target="_blank" title="Abrir ficha pública" aria-label={`Abrir ficha pública de ${mascota.nombre}`} className={CLASE_ICONO}>
            <ExternalLink className="h-4 w-4" aria-hidden="true"/>
          </Link>
          <button type="button" onClick={alTransferir} disabled={transferenciaOcupada} title="Transferir a otro dueño" aria-label={`Transferir a ${mascota.nombre} a otro dueño`} className={CLASE_ICONO}>
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true"/>
          </button>
        </div>
      </div>

      <div className="border-t border-border-subtle p-3">
        <button type="button" onClick={alCambiarEstado} disabled={estadoOcupado} className={claseBoton({ variante: extraviada ? "secundaria" : "fantasma", tamano: "sm", bloque: true, extra: extraviada ? "" : "!text-clay-ink hover:!bg-clay-tint" })}>
          <AlertTriangle className="h-4 w-4" aria-hidden="true"/>
          {extraviada ? "Marcar recuperada" : "Reportar extraviada"}
        </button>
      </div>

      {qrVisible && (<div className="border-t border-border bg-surface p-4">
          <EtiquetaIdentidad vertical codigoPublico={mascota.codigoPublico} nombre={mascota.nombre} urlImagenQr={urlImagenQr} alDescargar={alDescargarQr}/>
        </div>)}

      {transferenciaVisible && errorTransferencia && (<div role="alert" className="border-t border-border bg-clay-tint p-3 text-sm text-clay-ink">
          {errorTransferencia.hayPendiente ? (<>
              <p className="mb-2">
                Ya hay una transferencia pendiente para {mascota.nombre}. El código solo se muestra una vez al crearlo, así que no se puede volver a ver.
                Si lo perdiste, genera uno nuevo: el anterior dejará de funcionar.
              </p>
              <button type="button" onClick={alReemplazarTransferencia} disabled={transferenciaOcupada} className={claseBoton({ variante: "secundaria", tamano: "sm" })}>
                Generar un código nuevo
              </button>
            </>) : (<p>{errorTransferencia.mensaje}</p>)}
        </div>)}

      {transferenciaVisible && codigoTransferencia && (<div className="border-t border-border bg-pine-tint p-3 text-sm text-pine-ink">
          <p className="mb-2">
            Comparte este código con el nuevo dueño — solo se muestra una vez y vence en 24 horas. Lo canjea desde su
            propia cuenta en &quot;Tengo un código de transferencia&quot;.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-sm border border-border-strong bg-surface px-2 py-1 font-mono text-xs text-ink">{codigoTransferencia}</code>
            <button type="button" onClick={alCopiarTransferencia} className="flex min-h-9 items-center gap-1 whitespace-nowrap font-medium underline hover:no-underline">
              {transferenciaCopiada ? <Check className="h-3.5 w-3.5" aria-hidden="true"/> : <Copy className="h-3.5 w-3.5" aria-hidden="true"/>}
              {transferenciaCopiada ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>)}
    </article>);
}
