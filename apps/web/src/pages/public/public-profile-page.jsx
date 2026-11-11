import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { esquemaSolicitudContactoPublico } from "@hcm/shared";
import { HeartPulse, MessageSquareQuote, PawPrint, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { api, ErrorApi } from "../../api/client";
import { Aviso } from "../../components/ui/aviso";
import { claseBoton } from "../../components/ui/boton";
import { Campo } from "../../components/ui/campo";
import { InsigniaConfianza } from "../../components/ui/confidence-badge";
import { Panel, PanelCabecera, PanelCuerpo } from "../../components/ui/panel";
import { entrada } from "../../lib/entrada";
import { unirDatos } from "../../lib/texto";
const ETIQUETA_ESTADO = {
    al_dia: "Vacunas al día",
    atrasado: "Vacunas atrasadas",
    sin_registro: "Sin registro de vacunas",
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
    return (<div className="grid grid-cols-1 gap-0.5 border-b border-border-subtle py-3 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{etiqueta}</dt>
      <dd className="text-ink">{children}</dd>
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
        return (<div className="mx-auto min-h-screen max-w-reading bg-canvas px-4 py-10 sm:px-6">
        <Panel className="animate-pulse">
          <div className="h-2 bg-surface-sunken"/>
          <PanelCuerpo className="text-center">
            <div className="mx-auto mb-4 h-28 w-28 rounded-full bg-surface-sunken"/>
            <div className="mx-auto mb-2 h-4 w-1/2 rounded bg-surface-sunken"/>
            <div className="mx-auto h-3 w-1/3 rounded bg-surface-sunken"/>
          </PanelCuerpo>
        </Panel>
      </div>);
    }
    if (consultaPerfil.isError) {
        const noEncontrado = consultaPerfil.error instanceof ErrorApi && consultaPerfil.error.status === 404;
        return (<div className="mx-auto min-h-screen max-w-reading bg-canvas px-4 py-16 sm:px-6">
        <Aviso variante={noEncontrado ? "neutro" : "peligro"} titulo={noEncontrado ? "Placa no encontrada" : "No se pudo cargar la ficha"}>
          <p>
            {noEncontrado
                ? "No se encontró ninguna mascota con este código QR."
                : "Revisa tu conexión e intenta de nuevo."}
          </p>
          {!noEncontrado && (<button type="button" onClick={() => consultaPerfil.refetch()} className={claseBoton({ variante: "secundaria", extra: "mt-3" })}>
              Reintentar
            </button>)}
        </Aviso>
      </div>);
    }
    const perfil = consultaPerfil.data;
    const hayIdentificacion = perfil.colorSenas || perfil.temperamento || perfil.esterilizada !== null;
    return (<div className="min-h-screen bg-canvas">
      <main id="contenido" className="mx-auto max-w-reading space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        {/* Extraviada: un solo aviso sólido arriba de todo, antes que cualquier otro dato. */}
        {perfil.estaExtraviada && (<Aviso variante="extraviada" titulo="Esta mascota fue reportada como extraviada">
            {perfil.extraviadaDesde && <p>Desde el {formatearFecha(perfil.extraviadaDesde)}.</p>}
            <p>Si la encontraste, contacta al dueño desde el formulario de esta ficha.</p>
          </Aviso>)}

        {/* Identidad: la ficha reproduce la placa; el estado de vacunación es su sello. */}
        <Panel>
          <PanelCuerpo className="text-center">
            {perfil.urlFoto ? (<img src={perfil.urlFoto} alt={perfil.nombreMascota ?? "mascota"} className="mx-auto mb-4 h-36 w-36 rounded-full border border-border object-cover shadow-sm"/>) : (<div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center rounded-full border border-border bg-pine-tint">
                <PawPrint className="h-14 w-14 text-pine-ink" aria-hidden="true"/>
              </div>)}
            <h1 className="font-display text-4xl font-semibold text-ink">{perfil.nombreMascota ?? "Mascota"}</h1>
            <p className="mt-1 text-ink-soft">
              {unirDatos([perfil.especie, perfil.raza, perfil.sexo, formatearEdad(perfil.edadMeses)])}
            </p>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-ink">
              <ShieldCheck className="h-4 w-4 text-pine" aria-hidden="true"/>
              {ETIQUETA_ESTADO[perfil.estadoVacunacion]}
            </p>
          </PanelCuerpo>
        </Panel>

        {perfil.alertasMedicas && (<Panel tono="alerta" role="alert">
            <PanelCabecera tono="alerta">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><HeartPulse className="h-5 w-5" aria-hidden="true"/> Alerta médica</h2>
            </PanelCabecera>
            <PanelCuerpo><p className="font-medium text-ink">{perfil.alertasMedicas}</p></PanelCuerpo>
          </Panel>)}

        {hayIdentificacion && (<Panel>
            <PanelCabecera titulo="Cómo identificarla"/>
            <PanelCuerpo>
              <dl>
                {perfil.colorSenas && <FilaDato etiqueta="Color y señas">{perfil.colorSenas}</FilaDato>}
                {perfil.temperamento && <FilaDato etiqueta="Temperamento">{perfil.temperamento}</FilaDato>}
                {perfil.esterilizada !== null && <FilaDato etiqueta="Esterilizada">{ETIQUETA_ESTERILIZADA[perfil.esterilizada]}</FilaDato>}
              </dl>
            </PanelCuerpo>
          </Panel>)}

        {perfil.notaDelDueno && (<Panel tono="hundido">
            <PanelCuerpo>
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-pine-ink">
                <MessageSquareQuote className="h-4 w-4" aria-hidden="true"/> Nota del dueño
              </p>
              <p className="text-ink">{perfil.notaDelDueno}</p>
            </PanelCuerpo>
          </Panel>)}

        {perfil.vacunas.length > 0 && (<Panel>
            <PanelCabecera titulo="Últimas vacunas"/>
            <PanelCuerpo>
              <ul>
                {perfil.vacunas.map((vacuna, indice) => (<li key={`${vacuna.nombre}-${vacuna.fecha}-${indice}`} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-border-subtle py-3 first:pt-0 last:border-b-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{vacuna.nombre}</p>
                      <div className="mt-1"><InsigniaConfianza nivel={vacuna.nivelConfianza}/></div>
                    </div>
                    <time className="shrink-0 font-mono text-sm text-ink-soft">{formatearFecha(vacuna.fecha)}</time>
                  </li>))}
              </ul>
            </PanelCuerpo>
          </Panel>)}

        {perfil.estaExtraviada && (<Panel>
            <PanelCabecera titulo="Contactar al dueño"/>
            <PanelCuerpo>
              {perfil.mensajeContacto && <p className="mb-4 text-ink-soft">{perfil.mensajeContacto}</p>}
              {enviarContacto.isSuccess ? (<Aviso variante="info">
                  <p>Mensaje enviado. El dueño no ve tus datos aquí; te contactará por el medio que dejaste.</p>
                </Aviso>) : mostrarFormulario ? (<form className="space-y-4" noValidate onSubmit={handleSubmit((values) => enviarContacto.mutate(values))}>
                  <Campo etiqueta="Tu nombre" autoComplete="name" error={errors.nombreContacto?.message} {...register("nombreContacto")} {...entrada("nombreContacto")}/>
                  <Campo etiqueta="Tu teléfono o correo" autoComplete="off" error={errors.canalContacto?.message} {...register("canalContacto")} {...entrada("canalContacto")}/>
                  <Campo etiqueta="Mensaje" comoEtiqueta="textarea" rows={3} className="py-2" placeholder="Dónde la viste, cómo está..." error={errors.mensaje?.message} {...register("mensaje")} {...entrada("mensaje")}/>
                  {enviarContacto.isError && <Aviso variante="peligro"><p>No se pudo enviar el mensaje. Intenta de nuevo.</p></Aviso>}
                  <button type="submit" disabled={enviarContacto.isPending} className={claseBoton({ tamano: "lg", bloque: true })}>
                    {enviarContacto.isPending ? "Enviando..." : "Enviar mensaje"}
                  </button>
                </form>) : (<button type="button" onClick={() => setMostrarFormulario(true)} className={claseBoton({ tamano: "lg", bloque: true })}>
                  Contactar al dueño
                </button>)}
            </PanelCuerpo>
          </Panel>)}

        <p className="text-center text-xs text-ink-soft">
          Ficha pública de Historial Clínico Mascotas. No muestra datos personales del dueño.
        </p>
      </main>
    </div>);
}
