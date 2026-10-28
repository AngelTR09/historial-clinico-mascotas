import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { esquemaSolicitudAccesoVeterinarioMascota, extraerTokenQr } from "@hcm/shared";
import { CameraOff, CheckCircle2, Clock, PawPrint, QrCode, ScanLine, XCircle } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { AvisoError } from "../../components/ui/error-banner";
import { EncabezadoPaginaVeterinario } from "../../components/vet/vet-page-header";
import { obtenerTokenVeterinario } from "../../lib/auth-storage";
// html5-qrcode agrega ~340 KB minificados: solo lo descarga quien de
// verdad abre el escaner, no cada dueno que nunca visita esta pantalla.
const EscanerQr = lazy(() => import("../../components/vet/qr-scanner").then((m) => ({ default: m.EscanerQr })));
const INFO_ESTADO = {
    pendiente: { icono: Clock, texto: "Tu cuenta está en revisión. Podrás escanear mascotas cuando la aprueben.", className: "text-gold-dark bg-gold-tint" },
    aprobado: { icono: CheckCircle2, texto: "Cuenta aprobada. Ya puedes escanear mascotas para registrar sus atenciones.", className: "text-pine-dark bg-pine-tint" },
    rechazado: { icono: XCircle, texto: "Tu cuenta no fue aprobada. Si crees que es un error, contacta al equipo de Historial Clínico Mascotas.", className: "text-clay-dark bg-clay-tint" },
};
export function PaginaPanelVeterinario() {
    const navigate = useNavigate();
    const tokenVeterinario = obtenerTokenVeterinario();
    const [escanerActivo, setEscanerActivo] = useState(false);
    const [errorCamara, setErrorCamara] = useState(null);
    const consultaVeterinario = useQuery({
        queryKey: ["vet-me"],
        queryFn: () => api.get("/vets/me", { token: tokenVeterinario }),
    });
    const { register, handleSubmit, setValue, formState: { errors }, } = useForm({ resolver: zodResolver(esquemaSolicitudAccesoVeterinarioMascota) });
    const solicitarAcceso = useMutation({
        // La cámara lee la URL de la ficha pública; el acceso necesita solo el token.
        mutationFn: (input) => api.post("/vets/pet-access", { tokenQr: extraerTokenQr(input.tokenQr) }, { token: tokenVeterinario }),
        onSuccess: (data) => {
            navigate(`/vet/pets/${data.idMascota}`, { state: { tokenAcceso: data.token, expiraEn: data.expiraEn } });
        },
    });
    function manejarEscaneo(textoDecodificado) {
        setEscanerActivo(false);
        setValue("tokenQr", textoDecodificado);
        solicitarAcceso.mutate({ tokenQr: textoDecodificado });
    }
    function manejarErrorCamara(mensaje) {
        setEscanerActivo(false);
        setErrorCamara(mensaje);
    }
    const estado = consultaVeterinario.data ? INFO_ESTADO[consultaVeterinario.data.estado] : null;
    const IconoEstado = estado?.icono;
    return (<div className="min-h-screen bg-paper">
      <EncabezadoPaginaVeterinario mostrarCerrarSesion/>
      <main id="contenido" className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="mb-6 font-display text-2xl font-semibold text-ink">Panel del veterinario</h1>

        {consultaVeterinario.isLoading && <p className="text-sm text-ink-soft">Cargando...</p>}
        {consultaVeterinario.isError && (<div className="mb-6">
            <AvisoError mensaje="No se pudo cargar tu cuenta profesional." alReintentar={() => consultaVeterinario.refetch()}/>
          </div>)}

        {estado && IconoEstado && (<div className={`mb-6 flex items-start gap-2 rounded-lg p-3 text-sm ${estado.className}`}>
            <IconoEstado className="mt-0.5 h-4 w-4 shrink-0"/>
            <p>{estado.texto}</p>
          </div>)}

        {consultaVeterinario.data?.estado === "aprobado" && (<div className="rounded-xl border border-sand bg-paper-raised p-4">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <QrCode className="h-4 w-4 text-pine"/> Escanear mascota
            </h2>
            <p className="mb-3 text-sm text-ink-soft">El acceso dura 4 horas y solo sirve para esta mascota.</p>

            {escanerActivo ? (<div className="mb-4">
                <Suspense fallback={<p className="py-6 text-center text-sm text-ink-faint">Cargando cámara...</p>}>
                  <EscanerQr alEscanear={manejarEscaneo} alError={manejarErrorCamara}/>
                </Suspense>
                <button type="button" onClick={() => setEscanerActivo(false)} className="mt-3 min-h-12 w-full rounded-md border border-sand-dark text-sm text-ink hover:bg-paper">
                  Cancelar
                </button>
              </div>) : (<button type="button" onClick={() => {
                    setErrorCamara(null);
                    setEscanerActivo(true);
                }} className="mb-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-pine text-sm font-medium text-white hover:bg-pine-dark">
                <ScanLine className="h-4 w-4"/> Escanear con cámara
              </button>)}

            {errorCamara && (<p className="mb-3 flex items-start gap-2 rounded-md bg-clay-tint p-2 text-xs text-clay-dark">
                <CameraOff className="mt-0.5 h-3.5 w-3.5 shrink-0"/>
                No se pudo usar la cámara ({errorCamara}). Pega el código manualmente.
              </p>)}

            <p className="mb-2 text-center text-xs text-ink-faint">— o pégalo manualmente —</p>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSubmit((values) => solicitarAcceso.mutate(values))}>
              <input className="min-h-11 flex-1 rounded-md border border-sand-dark px-3 text-sm font-mono focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" placeholder="código QR" {...register("tokenQr")}/>
              <button type="submit" disabled={solicitarAcceso.isPending} className="min-h-11 rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50">
                {solicitarAcceso.isPending ? "..." : "Entrar"}
              </button>
            </form>
            {errors.tokenQr && <p className="mt-1 text-xs text-clay-dark">{errors.tokenQr.message}</p>}
            {solicitarAcceso.isError && <p className="mt-1 text-xs text-clay-dark">{solicitarAcceso.error.message}</p>}
          </div>)}

        {consultaVeterinario.data?.estado === "aprobado" && (<div className="mt-4 rounded-xl border border-sand bg-white p-4">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <PawPrint className="h-4 w-4 text-pine"/> ¿El dueño no usa el sistema?
            </h2>
            <p className="mb-3 text-sm text-ink-soft">Registra a su mascota y a su dueño aquí mismo y atiende de inmediato.</p>
            <Link to="/vet/pets/new" className="flex min-h-11 items-center justify-center rounded-md border border-pine px-4 text-sm font-medium text-pine hover:bg-pine-tint">
              Registrar mascota y dueño
            </Link>
          </div>)}
      </main>
    </div>);
}
