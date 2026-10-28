import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { esquemaSolicitudContactoPublico } from "@hcm/shared";
import { AlertTriangle, BadgeCheck, FileCheck2, HeartPulse, MessageSquareQuote, PawPrint, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { api, ErrorApi } from "../../api/client";
const ETIQUETA_ESTADO = {
    al_dia: "Vacunas al día",
    atrasado: "Vacunas atrasadas",
    sin_registro: "Sin registro de vacunas",
};
const ETIQUETA_CONFIANZA = {
    verificado: { texto: "Validada por veterinario", icono: BadgeCheck, clase: "text-pine" },
    con_evidencia: { texto: "Con foto de respaldo · sin validar", icono: FileCheck2, clase: "text-gold" },
    declarado: { texto: "Declarada por el dueño · sin validar", icono: null, clase: "text-ink-soft" },
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
function formatearFecha(fechaIso) {
    return new Date(`${fechaIso}T00:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}
const ETIQUETA_ESTERILIZADA = { true: "Sí", false: "No" };

function FilaDato({ etiqueta, children }) {
    return (<div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="shrink-0 text-ink-soft">{etiqueta}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>);
}

const esquemaFormularioContacto = esquemaSolicitudContactoPublico.omit({ tokenQr: true });
export function PaginaPerfilPublico() {
    const { qrToken } = useParams();
    const consultaPerfil = useQuery({
        queryKey: ["public-profile", qrToken],
        queryFn: () => api.get(`/public/pets/${qrToken}`),
        enabled: !!qrToken,
        retry: (count, error) => !(error instanceof ErrorApi && error.status === 404) && count < 2,
    });
    const [mostrarFormulario, setMostrarFormulario] = useState(false);
    const { register, handleSubmit, formState: { errors }, } = useForm({ resolver: zodResolver(esquemaFormularioContacto) });
    const enviarContacto = useMutation({
        mutationFn: (values) => api.post("/public/contact", { ...values, tokenQr: qrToken }),
    });
    if (consultaPerfil.isLoading) {
        return (<div className="mx-auto min-h-screen max-w-md bg-paper px-4 py-10 sm:px-6">
        <div className="animate-pulse overflow-hidden rounded-2xl border border-sand bg-paper-raised shadow-[0_1px_2px_rgba(27,35,31,0.06)]">
          <div className="h-2 bg-sand/60"/>
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 h-28 w-28 rounded-full bg-sand/50"/>
            <div className="mx-auto mb-2 h-4 w-1/2 rounded bg-sand/50"/>
            <div className="mx-auto h-3 w-1/3 rounded bg-sand/50"/>
          </div>
        </div>
      </div>);
    }
    if (consultaPerfil.isError) {
        const noEncontrado = consultaPerfil.error instanceof ErrorApi && consultaPerfil.error.status === 404;
        return (<div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-gold"/>
        <p className="text-ink">
          {noEncontrado
                ? "No se encontró ninguna mascota con este código QR."
                : "No se pudo cargar la ficha. Revisa tu conexión e intenta de nuevo."}
        </p>
        {!noEncontrado && (<button type="button" onClick={() => consultaPerfil.refetch()} className="mt-4 min-h-11 rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85">
            Reintentar
          </button>)}
      </div>);
    }
    const perfil = consultaPerfil.data;
    return (<div className="mx-auto min-h-screen max-w-md bg-paper px-4 py-10 sm:px-6">
      {/* La ficha reproduce la placa física: una franja superior como la
            cinta de un carnet, y el estado de vacunación como su sello. */}
      <div className="overflow-hidden rounded-2xl border border-sand bg-paper-raised shadow-[0_1px_2px_rgba(27,35,31,0.06)]">
        <div className={`h-2 ${perfil.estaExtraviada ? "bg-clay" : "bg-pine"}`}/>
        <div className="p-6 text-center">
          {perfil.urlFoto ? (<img src={perfil.urlFoto} alt={perfil.nombreMascota ?? "mascota"} className="mx-auto mb-4 h-36 w-36 rounded-full object-cover ring-4 ring-paper-raised shadow-[var(--shadow-lift)]"/>) : (<div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center rounded-full bg-pine-tint">
              <PawPrint className="h-14 w-14 text-pine"/>
            </div>)}

          <h1 className="font-display text-2xl font-semibold text-ink">{perfil.nombreMascota ?? "Mascota"}</h1>
          <p className="mb-4 text-sm capitalize text-ink-soft">
            {[perfil.especie, perfil.raza, perfil.sexo, formatearEdad(perfil.edadMeses)].filter(Boolean).join(" · ")}
          </p>

          {perfil.estaExtraviada && (<div className="mb-4 rounded-md bg-clay-tint p-3 text-sm font-medium text-clay-dark">
              Esta mascota fue reportada como extraviada
              {perfil.extraviadaDesde && <span className="block text-xs font-normal">Desde el {formatearFecha(perfil.extraviadaDesde)}</span>}
            </div>)}

          {perfil.alertasMedicas && (<div role="alert" className="mb-4 rounded-md border-2 border-clay bg-clay-tint p-3 text-left">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-clay-dark">
                <HeartPulse className="h-4 w-4"/> Alerta médica
              </p>
              <p className="text-sm font-medium text-ink">{perfil.alertasMedicas}</p>
            </div>)}

          <div className="mb-4 flex items-center justify-center gap-2 text-sm text-ink-soft">
            <ShieldCheck className="h-4 w-4 text-gold"/>
            {ETIQUETA_ESTADO[perfil.estadoVacunacion]}
          </div>

          {(perfil.colorSenas || perfil.temperamento || perfil.esterilizada !== null) && (<div className="mb-4 border-t border-sand pt-4 text-left">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Cómo identificarla</h2>
              <dl className="space-y-2">
                {perfil.colorSenas && <FilaDato etiqueta="Color y señas">{perfil.colorSenas}</FilaDato>}
                {perfil.temperamento && <FilaDato etiqueta="Temperamento">{perfil.temperamento}</FilaDato>}
                {perfil.esterilizada !== null && <FilaDato etiqueta="Esterilizada">{ETIQUETA_ESTERILIZADA[perfil.esterilizada]}</FilaDato>}
              </dl>
            </div>)}

          {perfil.notaDelDueno && (<div className="mb-4 rounded-md border border-sand bg-pine-tint p-3 text-left">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-pine-dark">
                <MessageSquareQuote className="h-4 w-4"/> Nota del dueño
              </p>
              <p className="text-sm text-ink">{perfil.notaDelDueno}</p>
            </div>)}

          {perfil.vacunas.length > 0 && (<div className="mb-4 border-t border-sand pt-4 text-left">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Últimas vacunas</h2>
              <ul className="space-y-2">
                {perfil.vacunas.map((vacuna, indice) => {
                const confianza = ETIQUETA_CONFIANZA[vacuna.nivelConfianza];
                const Icono = confianza.icono;
                return (<li key={`${vacuna.nombre}-${vacuna.fecha}-${indice}`} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-ink">{vacuna.nombre}</p>
                        <p className={`flex items-center gap-1 text-xs ${confianza.clase}`}>
                          {Icono && <Icono className="h-3 w-3"/>}
                          {confianza.texto}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-ink-soft">{formatearFecha(vacuna.fecha)}</span>
                    </li>);
            })}
              </ul>
            </div>)}

          {perfil.mensajeContacto && <p className="mb-4 text-sm text-ink-soft">{perfil.mensajeContacto}</p>}

          {perfil.estaExtraviada && (<>
              {enviarContacto.isSuccess ? (<p className="rounded-md bg-pine-tint p-3 text-sm font-medium text-pine-dark">
                  Mensaje enviado. El dueño no ve tus datos aquí; te contactará por el medio que dejaste.
                </p>) : mostrarFormulario ? (<form className="space-y-3 text-left" onSubmit={handleSubmit((values) => enviarContacto.mutate(values))}>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ink">Tu nombre</label>
                    <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("nombreContacto")}/>
                    {errors.nombreContacto && <p className="mt-1 text-xs text-clay-dark">{errors.nombreContacto.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ink">Tu teléfono o correo</label>
                    <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("canalContacto")}/>
                    {errors.canalContacto && <p className="mt-1 text-xs text-clay-dark">{errors.canalContacto.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ink">Mensaje</label>
                    <textarea rows={3} className="w-full rounded-md border border-sand-dark px-3 py-2 text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" placeholder="Dónde la viste, cómo está..." {...register("mensaje")}/>
                    {errors.mensaje && <p className="mt-1 text-xs text-clay-dark">{errors.mensaje.message}</p>}
                  </div>
                  {enviarContacto.isError && <p className="text-sm text-clay-dark">No se pudo enviar el mensaje. Intenta de nuevo.</p>}
                  <button type="submit" disabled={enviarContacto.isPending} className="min-h-12 w-full rounded-md bg-ink text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50">
                    {enviarContacto.isPending ? "Enviando..." : "Enviar mensaje"}
                  </button>
                </form>) : (<button type="button" onClick={() => setMostrarFormulario(true)} className="min-h-12 w-full rounded-md bg-ink text-sm font-medium text-white hover:bg-ink/85">
                  Contactar al dueño
                </button>)}
            </>)}
          <p className="mt-2 border-t border-sand pt-4 text-xs text-ink-soft">
            Ficha pública de Historial Clínico Mascotas. No muestra datos personales del dueño.
          </p>
        </div>
      </div>
    </div>);
}
