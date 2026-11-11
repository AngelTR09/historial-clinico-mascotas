import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { esquemaCreacionEventoSalud } from "@hcm/shared";
import { ArrowLeft, Bug, CloudUpload, History, Paperclip, Pencil, Stethoscope, Syringe, Pill as TreatmentIcon, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { api, esFalloTransitorio } from "../../api/client";
import { SelectorFotoMascota } from "../../components/pets/pet-photo-picker";
import { prepararFotoMascota, subirFotoMascota } from "../../lib/pet-photo";
import { InsigniaConfianza } from "../../components/ui/confidence-badge";
import { FormularioDatosPublicosMascota } from "../../components/pets/pet-public-data-form";
import { AvisoError } from "../../components/ui/error-banner";
import { EsqueletoLista } from "../../components/ui/list-skeleton";
import { EncabezadoPagina } from "../../components/ui/page-header";
import { useSubidasPendientesDeMascota } from "../../hooks/use-offline-queue";
import { etiquetaTipoEvento, TIPOS_EVENTO_SALUD } from "../../lib/event-types";
import { encolarSubidaPendiente } from "../../lib/offline-queue";
import { claseBoton } from "../../components/ui/boton";
import { Aviso } from "../../components/ui/aviso";
import { PUNTO_CONFIANZA } from "../../components/ui/confidence-badge";
import { EtiquetaIdentidad } from "../../components/pets/identity-tag";
import { Panel, PanelCabecera, PanelCuerpo } from "../../components/ui/panel";
import { descargarSvgPlacaQr, generarSvgPlacaQr } from "../../lib/qr-placa";
import { entrada } from "../../lib/entrada";
import { Entrada } from "../../components/ui/campo";
import { HACE_30_ANIOS, HOY } from "../../lib/fechas";
const ICONO_EVENTO = {
    vacuna: Syringe,
    chequeo: Stethoscope,
    tratamiento: TreatmentIcon,
    desparasitacion: Bug,
};
export function PaginaDetalleMascota() {
    const { petId } = useParams();
    const queryClient = useQueryClient();
    const consultaMascotas = useQuery({ queryKey: ["pets"], queryFn: () => api.get("/pets") });
    const mascota = consultaMascotas.data?.find((m) => m.id === petId);
    const cambiarFoto = useMutation({
        mutationFn: async (archivo) => subirFotoMascota(petId, await prepararFotoMascota(archivo)),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pets"] }),
    });
    const consultaEventos = useQuery({
        queryKey: ["health-events", petId],
        queryFn: () => api.get(`/pets/${petId}/health-events`),
        enabled: !!petId,
    });
    const subidasPendientes = useSubidasPendientesDeMascota(petId);
    const eventosPendientes = subidasPendientes.filter((item) => item.clase === "evento-salud");
    const conteoAdjuntosPendientesPorEvento = new Map();
    for (const item of subidasPendientes) {
        if (item.clase === "adjunto") {
            conteoAdjuntosPendientesPorEvento.set(item.idEvento, (conteoAdjuntosPendientesPorEvento.get(item.idEvento) ?? 0) + 1);
        }
    }
    const [claveIdempotencia, setClaveIdempotencia] = useState(() => crypto.randomUUID());
    const [eventoCorrigiendo, setEventoCorrigiendo] = useState(null);
    const { register, handleSubmit, reset, trigger, formState: { errors }, } = useForm({
        resolver: zodResolver(esquemaCreacionEventoSalud),
        defaultValues: { idMascota: petId, tipo: "chequeo", claveIdempotencia },
    });
    /**
     * RN 2: un evento no se edita ni se borra — corregirlo crea uno nuevo
     * que lo referencia por corrigeEventoId. Precarga tipo y veterinario
     * del original; fecha y descripción quedan en blanco para escribir la
     * corrección real.
     */
    function iniciarCorreccion(evento) {
        setEventoCorrigiendo(evento);
        const siguienteClave = crypto.randomUUID();
        setClaveIdempotencia(siguienteClave);
        reset({
            idMascota: petId,
            tipo: evento.tipo,
            nombreProfesional: evento.nombreProfesional ?? undefined,
            claveIdempotencia: siguienteClave,
            fechaEvento: "",
            textoOriginal: "",
        });
    }
    function cancelarCorreccion() {
        setEventoCorrigiendo(null);
        const siguienteClave = crypto.randomUUID();
        setClaveIdempotencia(siguienteClave);
        reset({ idMascota: petId, tipo: "chequeo", claveIdempotencia: siguienteClave, fechaEvento: "", textoOriginal: "", nombreProfesional: "" });
    }
    const crearEvento = useMutation({
        mutationFn: async (input) => {
            if (!navigator.onLine) {
                await encolarSubidaPendiente({
                    clase: "evento-salud",
                    id: input.claveIdempotencia,
                    idMascota: input.idMascota,
                    datos: input,
                    creadoEn: new Date().toISOString(),
                    intentos: 0,
                    ultimoError: null,
                });
                return;
            }
            try {
                await api.post("/health-events", input);
            }
            catch (err) {
                if (esFalloTransitorio(err)) {
                    await encolarSubidaPendiente({
                        clase: "evento-salud",
                        id: input.claveIdempotencia,
                        idMascota: input.idMascota,
                        datos: input,
                        creadoEn: new Date().toISOString(),
                        intentos: 0,
                        ultimoError: null,
                    });
                    return;
                }
                throw err;
            }
        },
        onSuccess: () => {
            cancelarCorreccion();
            queryClient.invalidateQueries({ queryKey: ["health-events", petId] });
            queryClient.invalidateQueries({ queryKey: ["offline-queue"] });
        },
    });
    const [idEventoSubiendo, setIdEventoSubiendo] = useState(null);
    async function manejarAdjuntar(idEvento, archivo) {
        setIdEventoSubiendo(idEvento);
        try {
            const encolar = () => encolarSubidaPendiente({
                clase: "adjunto",
                id: crypto.randomUUID(),
                idMascota: petId,
                idEvento,
                archivo,
                mime: archivo.type,
                tamanoBytes: archivo.size,
                nombreArchivo: archivo.name,
                creadoEn: new Date().toISOString(),
                intentos: 0,
                ultimoError: null,
            });
            if (!navigator.onLine) {
                await encolar();
                queryClient.invalidateQueries({ queryKey: ["offline-queue"] });
                return;
            }
            try {
                const { clave, url } = await api.post("/attachments/upload-url", { idEvento, mime: archivo.type });
                await api.putRaw(url, archivo);
                await api.post("/attachments", { idEvento, claveS3: clave, mime: archivo.type, tamanoBytes: archivo.size });
                queryClient.invalidateQueries({ queryKey: ["health-events", petId] });
            }
            catch (err) {
                if (esFalloTransitorio(err)) {
                    await encolar();
                    queryClient.invalidateQueries({ queryKey: ["offline-queue"] });
                    return;
                }
                throw err;
            }
        }
        finally {
            setIdEventoSubiendo(null);
        }
    }
    return (<div className="min-h-screen bg-canvas">
      <EncabezadoPagina mostrarCerrarSesion/>
      <main id="contenido" className="mx-auto max-w-page px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/dashboard" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4"/> Mis mascotas
        </Link>

        <div className="mb-6 flex items-center gap-4 border-b border-border-strong pb-4">
          <SelectorFotoMascota urlFoto={mascota?.urlFoto} nombre={mascota?.nombre} alElegir={(archivo) => cambiarFoto.mutate(archivo)} ocupado={cambiarFoto.isPending} error={cambiarFoto.isError ? cambiarFoto.error.message : null} tamano="md"/>
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">{mascota ? mascota.nombre : "Historial de salud"}</h1>
            {mascota && (<p className="text-sm text-ink-soft">
                {mascota.especie.charAt(0).toUpperCase() + mascota.especie.slice(1)} · <span className="font-mono">{mascota.codigoPublico}</span>
              </p>)}
          </div>
        </div>

        {consultaMascotas.isError && (<div className="mb-6">
            <AvisoError mensaje="No se pudo cargar los datos de la mascota." alReintentar={() => consultaMascotas.refetch()}/>
          </div>)}

        <div className="grid gap-6 md:grid-cols-[2fr_1fr] md:items-start">
          <div className="space-y-6">
        <section aria-labelledby="titulo-historial">
          <h2 id="titulo-historial" className="mb-4 border-b border-border-strong pb-2 font-display text-2xl font-semibold text-ink">Historial de salud</h2>
          {consultaEventos.isLoading && <EsqueletoLista />}
          {consultaEventos.isError && (<AvisoError mensaje="No se pudo cargar el historial de salud." alReintentar={() => consultaEventos.refetch()}/>)}
          {consultaEventos.data?.length === 0 && eventosPendientes.length === 0 && (<p className="text-sm text-ink-soft">Sin eventos todavía.</p>)}

          {/* Ledger cronológico: una regla vertical conecta cada evento, porque
            un historial de salud sí es una secuencia real en el tiempo. */}
          <div className="relative space-y-4 border-l-2 border-border pl-8">
            {consultaEventos.data?.map((evento) => {
            const Icono = ICONO_EVENTO[evento.tipo];
            const reemplazadoPor = consultaEventos.data?.find((e) => e.corrigeEventoId === evento.id);
            const corrigeOriginal = evento.corrigeEventoId
                ? consultaEventos.data?.find((e) => e.id === evento.corrigeEventoId)
                : undefined;
            return (<div key={evento.id} className={`relative rounded-lg border border-border bg-surface p-4 shadow-xs ${reemplazadoPor ? "opacity-60" : ""}`}>
                  <div className={`absolute -left-[41px] top-3 flex h-8 w-8 items-center justify-center rounded-full border-2 ${PUNTO_CONFIANZA[evento.nivelConfianza]}`}>
                    <Icono className="h-4 w-4" aria-hidden="true"/>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className={`font-medium capitalize text-ink ${reemplazadoPor ? "line-through" : ""}`}>
                        {etiquetaTipoEvento(evento.tipo)} · {evento.textoOriginal}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                        <span>{evento.fechaEvento}</span>
                        <InsigniaConfianza nivel={evento.nivelConfianza}/>
                      </div>
                      {corrigeOriginal && (<p className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                          <History className="h-3.5 w-3.5"/>
                          Corrige el evento del {corrigeOriginal.fechaEvento}
                        </p>)}
                      {reemplazadoPor && (<p className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                          <History className="h-3.5 w-3.5"/>
                          Reemplazado por una corrección del {reemplazadoPor.fechaEvento}
                        </p>)}
                      {conteoAdjuntosPendientesPorEvento.has(evento.id) && (<p className="mt-1 flex items-center gap-1 text-xs text-pine-ink">
                          <CloudUpload className="h-3.5 w-3.5"/>
                          {conteoAdjuntosPendientesPorEvento.get(evento.id)} adjunto(s) pendiente(s) de subir
                        </p>)}
                    </div>
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => iniciarCorreccion(evento)} className={claseBoton({ variante: "fantasma", tamano: "sm" })}>
                        <Pencil className="h-4 w-4"/> Corregir
                      </button>
                      <label className="flex min-h-9 cursor-pointer items-center gap-1 whitespace-nowrap text-sm text-ink-soft hover:text-ink">
                        <Paperclip className="h-4 w-4"/>
                        {idEventoSubiendo === evento.id ? "Subiendo..." : "Adjuntar evidencia"}
                        <input type="file" accept="image/*,application/pdf" className="hidden" disabled={idEventoSubiendo !== null} onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    if (archivo)
                        {void manejarAdjuntar(evento.id, archivo);}
                    e.target.value = "";
                }}/>
                      </label>
                    </div>
                  </div>
                </div>);
        })}
            {eventosPendientes.map((item) => {
            const Icono = ICONO_EVENTO[item.datos.tipo];
            return (<div key={item.id} className="relative rounded-lg border border-dashed border-pine bg-pine-tint p-4">
                  <div className="absolute -left-[41px] top-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-pine bg-pine-tint text-pine-ink">
                    <Icono className="h-4 w-4" aria-hidden="true"/>
                  </div>
                  <p className="font-medium capitalize text-ink">
                    {item.datos.tipo} · {item.datos.textoOriginal}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-pine-ink">
                    <CloudUpload className="h-3.5 w-3.5"/>
                    {item.datos.fechaEvento} · pendiente de sincronizar{item.ultimoError ? ` (error: ${item.ultimoError})` : ""}
                  </p>
                </div>);
        })}
          </div>
        </section>

        <Panel>
          <PanelCabecera>
            <h2 className="text-lg font-semibold">{eventoCorrigiendo ? "Corregir evento" : "Registrar evento"}</h2>
            {eventoCorrigiendo && (<button type="button" onClick={cancelarCorreccion} className={claseBoton({ variante: "fantasma", tamano: "sm" })}>
                <X className="h-3.5 w-3.5"/> Cancelar
              </button>)}
          </PanelCabecera>
          <PanelCuerpo>
          {eventoCorrigiendo && (<Aviso variante="neutro" className="mb-4">
              <p>Corrigiendo &quot;{eventoCorrigiendo.textoOriginal}&quot; del {eventoCorrigiendo.fechaEvento}. El original se conserva y queda marcado
              como reemplazado (RN 2: un evento no se edita ni se borra).</p>
            </Aviso>)}
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit((values) => crearEvento.mutate({ ...values, idMascota: petId, claveIdempotencia, corrigeEventoId: eventoCorrigiendo?.id }))}>
            <input type="hidden" {...register("idMascota")} value={petId}/>
            <input type="hidden" {...register("claveIdempotencia")} value={claveIdempotencia}/>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Tipo</label>
              <select className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("tipo")}>
                {TIPOS_EVENTO_SALUD.map((tipo) => (<option key={tipo} value={tipo}>
                    {etiquetaTipoEvento(tipo)}
                  </option>))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Fecha</label>
              <input type="date" max={HOY} min={HACE_30_ANIOS} className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("fechaEvento", { onChange: () => trigger("fechaEvento") })}/>
              {errors.fechaEvento && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.fechaEvento.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-ink">Descripción</label>
              <Entrada className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" placeholder="Antirrábica, control anual, desparasitación..." {...register("textoOriginal")} {...entrada("textoEvento")}/>
              {errors.textoOriginal && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.textoOriginal.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-ink">Veterinario (opcional)</label>
              <Entrada className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("nombreProfesional")} {...entrada("profesional")}/>
            </div>
            <div className="sm:col-span-2">
              {crearEvento.isError && <p className="mb-2 text-sm text-clay-ink">{crearEvento.error.message}</p>}
              <button type="submit" disabled={crearEvento.isPending} className={claseBoton({ tamano: "lg", bloque: "movil" })}>
                {crearEvento.isPending ? "Guardando..." : eventoCorrigiendo ? "Guardar corrección" : "Registrar evento"}
              </button>
            </div>
          </form>
          </PanelCuerpo>
        </Panel>
          </div>
          <aside className="space-y-6">
            {mascota && (<Panel>
                <PanelCabecera titulo="Placa QR"/>
                <PanelCuerpo>
                  <EtiquetaIdentidad vertical codigoPublico={mascota.codigoPublico} nombre={mascota.nombre} urlImagenQr={`data:image/svg+xml;utf8,${encodeURIComponent(generarSvgPlacaQr(`${window.location.origin}/p/${mascota.tokenQr}`))}`} alDescargar={() => descargarSvgPlacaQr(`${window.location.origin}/p/${mascota.tokenQr}`, `placa-qr-${mascota.nombre}`)}/>
                </PanelCuerpo>
              </Panel>)}
            {mascota && <FormularioDatosPublicosMascota key={mascota.id} mascota={mascota}/>}
          </aside>
        </div>
      </main>
    </div>);
}
