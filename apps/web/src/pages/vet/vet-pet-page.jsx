import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, Clock, CornerDownRight, ExternalLink, FileText, History, Pill as TreatmentIcon, PawPrint, ScanText, Stethoscope, Syringe } from "lucide-react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { InsigniaConfianza } from "../../components/ui/confidence-badge";
import { FormularioRegistroVeterinario } from "../../components/vet/vet-event-form";
import { etiquetaTipoEvento } from "../../lib/event-types";
import { AvisoError } from "../../components/ui/error-banner";
import { EsqueletoLista } from "../../components/ui/list-skeleton";
import { EncabezadoPaginaVeterinario } from "../../components/vet/vet-page-header";
const ICONO_EVENTO = {
    vacuna: Syringe,
    chequeo: Stethoscope,
    tratamiento: TreatmentIcon,
    desparasitacion: Bug,
};
const ETIQUETA_ESTADO_MASCOTA = {
    activa: "Activa",
    extraviada: "Extraviada",
    fallecida: "Fallecida",
    transferida: "Transferida",
};
const ESTILO_ESTADO_MASCOTA = {
    activa: "bg-pine-tint text-pine-dark",
    extraviada: "bg-clay-tint text-clay-dark",
    fallecida: "bg-sand/40 text-ink-soft",
    transferida: "bg-gold-tint text-gold-dark",
};
const ETIQUETA_OCR = {
    pendiente: "OCR en proceso",
    procesado: "OCR procesado",
    fallido: "OCR fallido",
    omitido: "OCR no aplicado",
};
function formatearEdad(meses) {
    if (meses === null || meses === undefined) {
        return null;
    }
    if (meses < 12) {
        return meses === 1 ? "1 mes" : `${meses} meses`;
    }
    const anios = Math.floor(meses / 12);
    const resto = meses % 12;
    const textoAnios = anios === 1 ? "1 año" : `${anios} años`;
    return resto === 0 ? textoAnios : `${textoAnios} y ${resto} ${resto === 1 ? "mes" : "meses"}`;
}
function formatearFechaHora(iso) {
    return new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}
function FichaMascota({ mascota }) {
    const edad = formatearEdad(mascota.edadMeses);
    const datos = [mascota.especie, mascota.raza, mascota.sexo, edad].filter(Boolean).join(" · ");
    return (<section className="mb-6 rounded-xl border border-sand bg-paper-raised p-4">
      <div className="flex items-center gap-4">
        {mascota.urlFoto ? (<img src={mascota.urlFoto} alt={`Foto de ${mascota.nombre}`} className="h-20 w-20 shrink-0 rounded-full border border-sand object-cover"/>) : (<div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-pine-tint">
            <PawPrint className="h-8 w-8 text-pine" aria-hidden="true"/>
          </div>)}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-semibold text-ink">{mascota.nombre}</h1>
          <p className="text-sm capitalize text-ink-soft">{datos}</p>
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_ESTADO_MASCOTA[mascota.estado]}`}>
            {ETIQUETA_ESTADO_MASCOTA[mascota.estado]}
          </span>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-sand pt-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-faint">Código de registro</dt>
          <dd className="font-mono text-ink">{mascota.codigoPublico}</dd>
        </div>
      </dl>
    </section>);
}
function Evidencias({ adjuntos }) {
    if (adjuntos.length === 0) {
        return (<p className="mt-3 flex items-center gap-1 text-xs text-gold-dark">
        <FileText className="h-3.5 w-3.5"/> Sin evidencia adjunta.
      </p>);
    }
    return (<ul className="mt-3 space-y-3">
      {adjuntos.map((adjunto) => (<li key={adjunto.id} className="rounded-lg border border-sand bg-paper p-2">
          <div className="flex gap-3">
            {adjunto.mime.startsWith("image/") ? (<a href={adjunto.urlLectura} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Abrir la evidencia en tamaño completo">
                <img src={adjunto.urlLectura} alt="Evidencia adjunta al evento" loading="lazy" className="h-28 w-28 rounded-md border border-sand bg-paper-raised object-cover sm:h-36 sm:w-36"/>
              </a>) : (<a href={adjunto.urlLectura} target="_blank" rel="noreferrer" className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-sand bg-paper-raised text-xs text-pine hover:bg-pine-tint sm:h-36 sm:w-36">
                <ExternalLink className="h-5 w-5"/> Abrir archivo
              </a>)}
            <div className="min-w-0 flex-1 text-xs text-ink-soft">
              <p className="flex items-center gap-1 font-medium text-ink">
                <ScanText className="h-3.5 w-3.5"/> {ETIQUETA_OCR[adjunto.estadoOcr]}
                {adjunto.confianzaOcr !== null && ` · confianza ${Math.round(adjunto.confianzaOcr * 100)}%`}
              </p>
              {adjunto.resumenOcr ? (<p className="mt-1 break-words rounded bg-paper-raised p-2 text-ink">{adjunto.resumenOcr}</p>) : (<p className="mt-1">Sin texto extraído: compara la imagen a simple vista.</p>)}
              <p className="mt-1 text-ink-faint">Subida el {formatearFechaHora(adjunto.creadoEn)}</p>
            </div>
          </div>
        </li>))}
    </ul>);
}
function DetalleEvento({ evento }) {
    const Icono = ICONO_EVENTO[evento.tipo];
    return (<div className="flex gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine-tint">
        <Icono className="h-4 w-4 text-pine"/>
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium capitalize text-ink">
          {etiquetaTipoEvento(evento.tipo)} · {evento.nombreVacunaCanonica ?? evento.textoOriginal}
        </p>
        {evento.nombreVacunaCanonica && evento.nombreVacunaCanonica !== evento.textoOriginal && (<p className="break-words text-xs text-ink-faint">Declarado como: {evento.textoOriginal}</p>)}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span>{evento.fechaEvento}</span>
          <InsigniaConfianza nivel={evento.nivelConfianza}/>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          Registrado por {evento.nombreProfesional ?? (evento.nivelConfianza === "verificado" ? "un veterinario" : "el dueño (sin profesional indicado)")} · capturado el {formatearFechaHora(evento.creadoEn)}
        </p>
        {evento.corrigeEvento && (<p className="mt-1 flex items-start gap-1 text-xs text-gold-dark">
            <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0"/>
            <span>Corrige: {evento.corrigeEvento.tipo} · {evento.corrigeEvento.textoOriginal} ({evento.corrigeEvento.fechaEvento})</span>
          </p>)}
        {evento.corregidoPorEventoId && (<p className="mt-1 text-xs text-gold-dark">Corregido por un evento posterior.</p>)}
      </div>
    </div>);
}
export function PaginaMascotaVeterinario() {
    const { petId } = useParams();
    const location = useLocation();
    const queryClient = useQueryClient();
    const estado = location.state;
    const consultaVista = useQuery({
        queryKey: ["vet-view", petId],
        queryFn: () => api.get(`/pets/${petId}/vet-view`, { token: estado.tokenAcceso }),
        enabled: !!estado && !!petId,
    });
    if (!estado) {
        return <Navigate to="/vet/dashboard" replace/>;
    }
    const vista = consultaVista.data;
    return (<div className="min-h-screen bg-paper">
      <EncabezadoPaginaVeterinario mostrarCerrarSesion/>
      <main id="contenido" className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="mb-4 flex items-center gap-1 text-sm text-ink-soft">
          <Clock className="h-4 w-4"/> Acceso a esta mascota válido hasta las {new Date(estado.expiraEn).toLocaleTimeString("es-PE")}
        </p>

        {consultaVista.isLoading && <EsqueletoLista />}
        {consultaVista.isError && (<div className="mb-3">
            <AvisoError mensaje="No se pudo cargar la información de la mascota." alReintentar={() => consultaVista.refetch()}/>
          </div>)}

        {vista && (<>
            <FichaMascota mascota={vista.mascota}/>

            <h2 className="mb-3 font-display text-xl font-semibold text-ink">Registrar atención</h2>
            <FormularioRegistroVeterinario idMascota={petId} tokenAcceso={estado.tokenAcceso} alRegistrar={() => queryClient.invalidateQueries({ queryKey: ["vet-view", petId] })}/>

            <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-semibold text-ink">
              <History className="h-5 w-5 text-ink-soft"/> Historial ya resuelto
            </h2>
            <p className="mb-3 text-sm text-ink-soft">Lo que registras tú queda verificado; lo que declaró el dueño se distingue por su insignia. Un evento no se edita: se corrige con uno nuevo.</p>
            {vista.historial.length === 0 && <p className="text-sm text-ink-soft">Todavía no hay eventos en el expediente.</p>}
            <div className="space-y-3">
              {vista.historial.map((evento) => (<div key={evento.id} className="rounded-xl border border-sand bg-paper-raised p-4">
                  <DetalleEvento evento={evento}/>
                  {evento.adjuntos.length > 0 && (<details className="mt-3">
                      <summary className="flex min-h-11 cursor-pointer items-center text-sm text-pine">Ver evidencia ({evento.adjuntos.length})</summary>
                      <Evidencias adjuntos={evento.adjuntos}/>
                    </details>)}
                </div>))}
            </div>
          </>)}
      </main>
    </div>);
}
