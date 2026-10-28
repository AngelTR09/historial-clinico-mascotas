import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { esquemaCreacionEventoSalud } from "@hcm/shared";
import { ArrowLeft, Bug, CloudUpload, History, Paperclip, Pencil, Stethoscope, Syringe, Pill as TreatmentIcon, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
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
    const { register, handleSubmit, reset, formState: { errors }, } = useForm({
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
                if (err instanceof TypeError) {
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
                if (err instanceof TypeError) {
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
    return (<div className="min-h-screen bg-paper">
      <EncabezadoPagina mostrarCerrarSesion/>
      <main id="contenido" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/dashboard" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4"/> Mis mascotas
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <SelectorFotoMascota urlFoto={mascota?.urlFoto} nombre={mascota?.nombre} alElegir={(archivo) => cambiarFoto.mutate(archivo)} ocupado={cambiarFoto.isPending} error={cambiarFoto.isError ? cambiarFoto.error.message : null} tamano="md"/>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">{mascota ? mascota.nombre : "Historial de salud"}</h1>
            {mascota && (<p className="text-sm capitalize text-ink-soft">
                {mascota.especie} · <span className="font-mono">{mascota.codigoPublico}</span>
              </p>)}
          </div>
        </div>

        {consultaMascotas.isError && (<div className="mb-6">
            <AvisoError mensaje="No se pudo cargar los datos de la mascota." alReintentar={() => consultaMascotas.refetch()}/>
          </div>)}

        {mascota && <FormularioDatosPublicosMascota key={mascota.id} mascota={mascota}/>}

        <div className="mb-8">
          {consultaEventos.isLoading && <EsqueletoLista />}
          {consultaEventos.isError && (<AvisoError mensaje="No se pudo cargar el historial de salud." alReintentar={() => consultaEventos.refetch()}/>)}
          {consultaEventos.data?.length === 0 && eventosPendientes.length === 0 && (<p className="text-sm text-ink-soft">Sin eventos todavía.</p>)}

          {/* Ledger cronológico: una regla vertical conecta cada evento, porque
            un historial de salud sí es una secuencia real en el tiempo. */}
          <div className="relative space-y-4 border-l-2 border-sand pl-6">
            {consultaEventos.data?.map((evento) => {
            const Icono = ICONO_EVENTO[evento.tipo];
            const reemplazadoPor = consultaEventos.data?.find((e) => e.corrigeEventoId === evento.id);
            const corrigeOriginal = evento.corrigeEventoId
                ? consultaEventos.data?.find((e) => e.id === evento.corrigeEventoId)
                : undefined;
            return (<div key={evento.id} className={`relative rounded-lg border border-sand bg-paper-raised p-4 ${reemplazadoPor ? "opacity-60" : ""}`}>
                  <div className="absolute -left-[31px] top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-pine">
                    <Icono className="h-3.5 w-3.5 text-white"/>
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
                      {conteoAdjuntosPendientesPorEvento.has(evento.id) && (<p className="mt-1 flex items-center gap-1 text-xs text-gold-dark">
                          <CloudUpload className="h-3.5 w-3.5"/>
                          {conteoAdjuntosPendientesPorEvento.get(evento.id)} adjunto(s) pendiente(s) de subir
                        </p>)}
                    </div>
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => iniciarCorreccion(evento)} className="flex min-h-9 items-center gap-1 whitespace-nowrap text-sm text-ink-soft hover:text-ink">
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
            return (<div key={item.id} className="relative rounded-lg border border-gold/30 bg-gold-tint p-4">
                  <div className="absolute -left-[31px] top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-gold">
                    <Icono className="h-3.5 w-3.5 text-white"/>
                  </div>
                  <p className="font-medium capitalize text-ink">
                    {item.datos.tipo} · {item.datos.textoOriginal}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-gold-dark">
                    <CloudUpload className="h-3.5 w-3.5"/>
                    {item.datos.fechaEvento} · pendiente de sincronizar{item.ultimoError ? ` (error: ${item.ultimoError})` : ""}
                  </p>
                </div>);
        })}
          </div>
        </div>

        <div className="rounded-xl border border-sand bg-paper-raised p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">{eventoCorrigiendo ? "Corregir evento" : "Registrar evento"}</h2>
            {eventoCorrigiendo && (<button type="button" onClick={cancelarCorreccion} className="flex min-h-9 items-center gap-1 text-sm text-ink-soft hover:text-ink">
                <X className="h-3.5 w-3.5"/> Cancelar
              </button>)}
          </div>
          {eventoCorrigiendo && (<p className="mb-3 flex items-center gap-1 rounded-md bg-gold-tint p-2 text-xs text-gold-dark">
              <History className="h-3.5 w-3.5 shrink-0"/>
              Corrigiendo &quot;{eventoCorrigiendo.textoOriginal}&quot; del {eventoCorrigiendo.fechaEvento}. El original se conserva y queda marcado
              como reemplazado (RN 2: un evento no se edita ni se borra).
            </p>)}
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit((values) => crearEvento.mutate({ ...values, idMascota: petId, claveIdempotencia, corrigeEventoId: eventoCorrigiendo?.id }))}>
            <input type="hidden" {...register("idMascota")} value={petId}/>
            <input type="hidden" {...register("claveIdempotencia")} value={claveIdempotencia}/>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Tipo</label>
              <select className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("tipo")}>
                {TIPOS_EVENTO_SALUD.map((tipo) => (<option key={tipo} value={tipo}>
                    {etiquetaTipoEvento(tipo)}
                  </option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Fecha</label>
              <input type="date" className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("fechaEvento")}/>
              {errors.fechaEvento && <p className="mt-1 text-xs text-clay-dark">{errors.fechaEvento.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-ink">Descripción</label>
              <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" placeholder="Antirrábica, control anual, desparasitación..." {...register("textoOriginal")}/>
              {errors.textoOriginal && <p className="mt-1 text-xs text-clay-dark">{errors.textoOriginal.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-ink">Veterinario (opcional)</label>
              <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("nombreProfesional")}/>
            </div>
            <div className="sm:col-span-2">
              {crearEvento.isError && <p className="mb-2 text-sm text-clay-dark">{crearEvento.error.message}</p>}
              <button type="submit" disabled={crearEvento.isPending} className="min-h-12 w-full rounded-md bg-pine font-medium text-white hover:bg-pine-dark disabled:opacity-50 sm:w-auto sm:px-6">
                {crearEvento.isPending ? "Guardando..." : eventoCorrigiendo ? "Guardar corrección" : "Registrar evento"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>);
}
