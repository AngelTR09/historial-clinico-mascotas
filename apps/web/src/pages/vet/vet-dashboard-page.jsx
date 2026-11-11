import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { esquemaSolicitudAccesoVeterinarioMascota, extraerTokenQr } from "@hcm/shared";
import { CameraOff, PawPrint, QrCode, ScanLine, } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { AvisoError } from "../../components/ui/error-banner";
import { EncabezadoPaginaVeterinario } from "../../components/vet/vet-page-header";
import { obtenerTokenVeterinario } from "../../lib/auth-storage";
import { claseBoton } from "../../components/ui/boton";
import { EncabezadoSeccion } from "../../components/ui/encabezado-seccion";
import { entrada } from "../../lib/entrada";
import { Entrada } from "../../components/ui/campo";
import { Aviso } from "../../components/ui/aviso";
import { Panel, PanelCabecera, PanelCuerpo } from "../../components/ui/panel";
// html5-qrcode agrega ~340 KB minificados: solo lo descarga quien de
// verdad abre el escaner, no cada dueno que nunca visita esta pantalla.
const EscanerQr = lazy(() => import("../../components/vet/qr-scanner").then((m) => ({ default: m.EscanerQr })));
const INFO_ESTADO = {
    pendiente: { texto: "Tu cuenta está en revisión. Podrás escanear mascotas cuando la aprueben.", variante: "neutro" },
    aprobado: { texto: "Cuenta aprobada. Ya puedes escanear mascotas para registrar sus atenciones.", variante: "info" },
    rechazado: { texto: "Tu cuenta no fue aprobada. Si crees que es un error, contacta al equipo de Historial Clínico Mascotas.", variante: "peligro" },
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
    return (<div className="min-h-screen bg-canvas">
      <EncabezadoPaginaVeterinario mostrarCerrarSesion/>
      <main id="contenido" className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-8">
        <EncabezadoSeccion sobretitulo="Veterinario" titulo="Panel del veterinario" descripcion="Abre un expediente con el QR de la placa y registra la atención."/>

        {consultaVeterinario.isLoading && <p className="text-sm text-ink-soft">Cargando...</p>}
        {consultaVeterinario.isError && (<div className="mb-6">
            <AvisoError mensaje="No se pudo cargar tu cuenta profesional." alReintentar={() => consultaVeterinario.refetch()}/>
          </div>)}

        {estado && (<Aviso variante={estado.variante} className="mb-6">
            <p>{estado.texto}</p>
          </Aviso>)}

        {consultaVeterinario.data?.estado === "aprobado" && (<Panel>
            <PanelCabecera>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><QrCode className="h-5 w-5 text-pine-ink" aria-hidden="true"/> Escanear mascota</h2>
            </PanelCabecera>
            <PanelCuerpo>
            <p className="mb-4 text-sm text-ink-soft">El acceso dura 4 horas y solo sirve para esta mascota.</p>

            {escanerActivo ? (<div className="mb-4">
                <Suspense fallback={<p className="py-6 text-center text-sm text-ink-faint">Cargando cámara...</p>}>
                  <EscanerQr alEscanear={manejarEscaneo} alError={manejarErrorCamara}/>
                </Suspense>
                <button type="button" onClick={() => setEscanerActivo(false)} className={claseBoton({ variante: "secundaria", tamano: "lg", bloque: true, extra: "mt-3" })}>
                  Cancelar
                </button>
              </div>) : (<button type="button" onClick={() => {
                    setErrorCamara(null);
                    setEscanerActivo(true);
                }} className={claseBoton({ tamano: "lg", bloque: true, extra: "mb-4" })}>
                <ScanLine className="h-4 w-4"/> Escanear con cámara
              </button>)}

            {errorCamara && (<Aviso variante="peligro" className="mb-4">
                <p className="flex items-start gap-2"><CameraOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/> No se pudo usar la cámara ({errorCamara}). Pega el código manualmente.</p>
              </Aviso>)}

            <p className="mb-2 text-center text-xs text-ink-faint">— o pégalo manualmente —</p>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSubmit((values) => solicitarAcceso.mutate(values))}>
              <Entrada className="min-h-11 flex-1 rounded-md border border-control-border px-3 text-sm font-mono bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" placeholder="código QR" {...register("tokenQr")} {...entrada("codigoQr")}/>
              <button type="submit" disabled={solicitarAcceso.isPending} className={claseBoton({})}>
                {solicitarAcceso.isPending ? "..." : "Entrar"}
              </button>
            </form>
            {errors.tokenQr && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.tokenQr.message}</p>}
            {solicitarAcceso.isError && <p className="mt-2 text-sm font-medium text-clay-ink">{solicitarAcceso.error.message}</p>}
            </PanelCuerpo>
          </Panel>)}

        {consultaVeterinario.data?.estado === "aprobado" && (<Panel className="mt-6">
            <PanelCabecera>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><PawPrint className="h-5 w-5 text-pine-ink" aria-hidden="true"/> ¿El dueño no usa el sistema?</h2>
            </PanelCabecera>
            <PanelCuerpo>
            <p className="mb-4 text-sm text-ink-soft">Registra a su mascota y a su dueño aquí mismo y atiende de inmediato.</p>
            <Link to="/vet/pets/new" className={claseBoton({ variante: "secundaria", bloque: true })}>
              Registrar mascota y dueño
            </Link>
            </PanelCuerpo>
          </Panel>)}
      </main>
    </div>);
}
