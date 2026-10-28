import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { esquemaCreacionCamada, esquemaCreacionMascota } from "@hcm/shared";
import { AlertTriangle, ArrowRightLeft, BellRing, Check, Copy, Download, ExternalLink, Plus, QrCode, Trash2 } from "lucide-react";
import { descargarSvgPlacaQr, generarSvgPlacaQr } from "../../lib/qr-placa";
import { useFieldArray, useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ErrorApi } from "../../api/client";
import { AvisoError } from "../../components/ui/error-banner";
import { EsqueletoLista } from "../../components/ui/list-skeleton";
import { AvatarMascota } from "../../components/pets/pet-avatar";
import { SelectorFotoMascota } from "../../components/pets/pet-photo-picker";
import { EncabezadoPagina } from "../../components/ui/page-header";
import { prepararFotoMascota, subirFotoMascota } from "../../lib/pet-photo";
export function PaginaPanel() {
    const queryClient = useQueryClient();
    const [idMascotaCopiada, setIdMascotaCopiada] = useState(null);
    const [idQrVisible, setIdQrVisible] = useState(null);
    async function copiarTokenQr(idMascota, tokenQr) {
        await navigator.clipboard.writeText(tokenQr);
        setIdMascotaCopiada(idMascota);
        setTimeout(() => setIdMascotaCopiada(null), 1500);
    }
    const consultaMascotas = useQuery({ queryKey: ["pets"], queryFn: () => api.get("/pets") });
    const consultaRecordatorios = useQuery({ queryKey: ["reminders"], queryFn: () => api.get("/reminders") });
    const actualizarEstado = useMutation({
        mutationFn: ({ idMascota, estado }) => api.patch(`/pets/${idMascota}/status`, { estado }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pets"] }),
    });
    const [codigoTransferencia, setCodigoTransferencia] = useState(null);
    const [transferenciaCopiada, setTransferenciaCopiada] = useState(false);
    const crearTransferencia = useMutation({
        mutationFn: (idMascota) => api.post("/transfers", { idMascota }),
        onSuccess: (resultado) => {
            setCodigoTransferencia({ idMascota: resultado.transferencia.idMascota, combinado: `${resultado.transferencia.id}:${resultado.codigo}` });
            setTransferenciaCopiada(false);
        },
    });
    async function copiarCodigoTransferencia(combinado) {
        await navigator.clipboard.writeText(combinado);
        setTransferenciaCopiada(true);
        setTimeout(() => setTransferenciaCopiada(false), 1500);
    }
    const [entradaCanje, setEntradaCanje] = useState("");
    const canjearTransferencia = useMutation({
        mutationFn: (combinado) => {
            const [idTransferencia, codigo] = combinado.trim().split(":");
            if (!idTransferencia || !codigo) {
                throw new ErrorApi("El código no tiene el formato correcto (idTransferencia:código)", 400);
            }
            return api.post("/transfers/redeem", { idTransferencia, codigo });
        },
        onSuccess: () => {
            setEntradaCanje("");
            queryClient.invalidateQueries({ queryKey: ["pets"] });
        },
    });
    const { register, handleSubmit, reset, formState: { errors }, } = useForm({ resolver: zodResolver(esquemaCreacionMascota) });
    // Foto opcional del alta: se elige antes de crear la mascota y se sube justo después,
    // porque la clave de almacenamiento lleva el id que recién existe al guardar.
    const [fotoNueva, setFotoNueva] = useState(null);
    useEffect(() => () => fotoNueva && URL.revokeObjectURL(fotoNueva.vistaPrevia), [fotoNueva]);
    const [errorFotoNueva, setErrorFotoNueva] = useState(null);
    function elegirFotoNueva(archivo) {
        setErrorFotoNueva(null);
        setFotoNueva({ archivo, vistaPrevia: URL.createObjectURL(archivo) });
    }
    const crearMascota = useMutation({
        mutationFn: async (input) => {
            const mascota = await api.post("/pets", input);
            if (fotoNueva) {
                try {
                    await subirFotoMascota(mascota.id, await prepararFotoMascota(fotoNueva.archivo));
                }
                catch (error) {
                    // La mascota ya quedó registrada (RN 8: el alta no depende de la imagen): se avisa y se puede reintentar desde su ficha.
                    setErrorFotoNueva(`La mascota se registró, pero la foto no se pudo subir: ${error.message} Puedes agregarla desde su ficha.`);
                }
            }
            return mascota;
        },
        onSuccess: () => {
            reset();
            setFotoNueva(null);
            queryClient.invalidateQueries({ queryKey: ["pets"] });
        },
    });
    const [modoFormulario, setModoFormulario] = useState("individual");
    const valoresPorDefectoCamada = { mascotas: [{ nombre: "", especie: "" }, { nombre: "", especie: "" }] };
    const { control: controlCamada, register: registrarCampoCamada, handleSubmit: manejarEnvioCamada, reset: reiniciarCamada, formState: { errors: erroresCamada }, } = useForm({ resolver: zodResolver(esquemaCreacionCamada), defaultValues: valoresPorDefectoCamada });
    const { fields: camposCamada, append: agregarCriaCamada, remove: quitarCriaCamada } = useFieldArray({
        control: controlCamada,
        name: "mascotas",
    });
    const crearCamada = useMutation({
        mutationFn: (input) => api.post("/pets/litter", input),
        onSuccess: () => {
            reiniciarCamada(valoresPorDefectoCamada);
            setModoFormulario("individual");
            queryClient.invalidateQueries({ queryKey: ["pets"] });
        },
    });
    // Albergue: hasta 100 mascotas, procesadas en cola (no bloquea al resto).
    // Una fila por línea, "nombre,especie" — más práctico que 100 campos de formulario.
    const [textoMasivo, setTextoMasivo] = useState("");
    const mascotasMasivas = textoMasivo
        .split("\n")
        .map((linea) => linea.trim())
        .filter((linea) => linea.length > 0)
        .map((linea) => {
        const [nombre, especie] = linea.split(",").map((parte) => parte?.trim() ?? "");
        return { nombre: nombre ?? "", especie: especie ?? "" };
    });
    const cargarMasiva = useMutation({
        mutationFn: (mascotas) => api.post("/pets/bulk", { mascotas }),
        onSuccess: () => {
            setTextoMasivo("");
        },
    });
    return (<div className="min-h-screen bg-paper">
      <EncabezadoPagina mostrarCerrarSesion/>
      <main id="contenido" className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="mb-6 font-display text-3xl font-semibold text-ink">Mis mascotas</h1>

        {!!consultaRecordatorios.data?.length && (<div className="mb-6 rounded-lg border border-gold/25 bg-gold-tint p-4">
            <h2 className="mb-2 flex items-center gap-1.5 font-medium text-gold-dark">
              <BellRing className="h-4 w-4"/> Vacunas y desparasitaciones por vencer
            </h2>
            <ul className="space-y-1 text-sm text-gold-dark">
              {consultaRecordatorios.data.map((recordatorio) => (<li key={`${recordatorio.idMascota}-${recordatorio.vacuna}`}>
                  <span className="font-medium">{recordatorio.nombreMascota}</span> · {recordatorio.vacuna} · vence el{" "}
                  {recordatorio.vencimiento}
                </li>))}
            </ul>
          </div>)}

        <div className="mb-8 space-y-3">
          {consultaMascotas.isLoading && <EsqueletoLista />}
          {consultaMascotas.isError && (<AvisoError mensaje="No se pudo cargar tu lista de mascotas." alReintentar={() => consultaMascotas.refetch()}/>)}
          {consultaMascotas.data?.length === 0 && (<div className="rise flex flex-col items-center rounded-xl border border-dashed border-sand-dark bg-paper-raised/60 px-6 py-10 text-center">
              <img src="/img/vacio-gato.webp" alt="" width="640" height="640" loading="lazy" className="mb-3 h-24 w-24 rounded-full object-cover object-[50%_35%] ring-4 ring-paper-raised shadow-soft"/>
              <p className="font-display text-lg font-semibold text-ink">Todavía no registraste ninguna mascota.</p>
              <p className="mt-1 max-w-xs text-sm text-ink-soft">Completa el formulario de abajo para crear su expediente y su placa QR.</p>
            </div>)}
          {consultaMascotas.data?.map((mascota, indice) => (<div key={mascota.id} style={{ "--i": indice }} className="lift rise overflow-hidden rounded-xl border border-sand bg-paper-raised">
              <div className="flex">
                {/* Talón tipo carnet: el codigoPublico es el número de un documento de identidad real. */}
                <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-sand-dark bg-pine-tint px-2 py-3 sm:w-20">
                  <AvatarMascota urlFoto={mascota.urlFoto} nombre={mascota.nombre} tamano="sm"/>
                  <span className="text-center font-mono text-[10px] leading-tight text-pine-dark">{mascota.codigoPublico}</span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold text-ink">
                      {mascota.nombre}
                      {mascota.estado === "extraviada" && (<span className="ml-2 inline-flex items-center gap-1 rounded-full bg-clay-tint px-2 py-0.5 align-middle text-xs font-medium text-clay-dark">
                          <AlertTriangle className="h-3 w-3"/> Extraviada
                        </span>)}
                    </p>
                    <p className="text-sm capitalize text-ink-soft">{mascota.especie}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => actualizarEstado.mutate({ idMascota: mascota.id, estado: mascota.estado === "extraviada" ? "activa" : "extraviada" })} disabled={actualizarEstado.isPending} className={`flex min-h-11 items-center gap-1 whitespace-nowrap rounded-md border px-3 text-sm font-medium disabled:opacity-50 ${mascota.estado === "extraviada"
                ? "border-pine/40 text-pine hover:bg-pine-tint"
                : "border-clay/40 text-clay-dark hover:bg-clay-tint"}`}>
                      <AlertTriangle className="h-4 w-4"/>
                      {mascota.estado === "extraviada" ? "Marcar recuperada" : "Reportar extraviada"}
                    </button>

                    <div className="flex items-center gap-1 rounded-md border border-sand-dark p-1">
                      <button type="button" onClick={() => copiarTokenQr(mascota.id, mascota.tokenQr)} title="Copiar código QR (para que un veterinario lo escanee o pegue en su panel)" className="flex h-11 w-11 items-center justify-center rounded text-ink-soft hover:bg-paper hover:text-ink">
                        {idMascotaCopiada === mascota.id ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>}
                      </button>
                      <button type="button" onClick={() => setIdQrVisible(idQrVisible === mascota.id ? null : mascota.id)} aria-expanded={idQrVisible === mascota.id} title="Ver placa QR" aria-label={`Ver placa QR de ${mascota.nombre}`} className={`flex h-11 w-11 items-center justify-center rounded hover:bg-paper hover:text-ink ${idQrVisible === mascota.id ? "bg-pine-tint text-pine-dark" : "text-ink-soft"}`}>
                        <QrCode className="h-4 w-4"/>
                      </button>
                      <button type="button" onClick={() => descargarSvgPlacaQr(`${window.location.origin}/p/${mascota.tokenQr}`, `placa-qr-${mascota.nombre}`)} title="Descargar la placa QR en SVG, lista para grabar con láser" aria-label={`Descargar placa QR de ${mascota.nombre}`} className="flex h-11 w-11 items-center justify-center rounded text-ink-soft hover:bg-paper hover:text-ink">
                        <Download className="h-4 w-4"/>
                      </button>
                      <Link to={`/p/${mascota.tokenQr}`} target="_blank" title="Abrir ficha pública" aria-label={`Abrir ficha pública de ${mascota.nombre}`} className="flex h-11 w-11 items-center justify-center rounded text-ink-soft hover:bg-paper hover:text-ink">
                        <ExternalLink className="h-4 w-4"/>
                      </Link>
                      <button type="button" onClick={() => crearTransferencia.mutate(mascota.id)} disabled={crearTransferencia.isPending} title="Transferir a otro dueño" className="flex h-11 w-11 items-center justify-center rounded text-ink-soft hover:bg-paper hover:text-ink disabled:opacity-50">
                        <ArrowRightLeft className="h-4 w-4"/>
                      </button>
                    </div>

                    <Link to={`/pets/${mascota.id}`} className="flex min-h-11 items-center whitespace-nowrap rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-ink/85">
                      Ver historial
                    </Link>
                  </div>
                </div>
              </div>

              {idQrVisible === mascota.id && (<div className="flex flex-col items-center gap-3 border-t border-sand bg-white p-4 sm:flex-row sm:items-center sm:gap-5">
                  <img src={`data:image/svg+xml;utf8,${encodeURIComponent(generarSvgPlacaQr(`${window.location.origin}/p/${mascota.tokenQr}`))}`} alt={`Código QR de la placa de ${mascota.nombre}`} width="160" height="160" className="h-40 w-40 shrink-0 rounded border border-sand"/>
                  <div className="text-center text-sm text-ink-soft sm:text-left">
                    <p className="font-medium text-ink">Placa QR de {mascota.nombre}</p>
                    <p className="mt-1">Muéstrala al veterinario para que abra el expediente. No contiene tus datos ni el código de identificación.</p>
                    <button type="button" onClick={() => descargarSvgPlacaQr(`${window.location.origin}/p/${mascota.tokenQr}`, `placa-qr-${mascota.nombre}`)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-ink/85">
                      <Download className="h-4 w-4"/> Descargar para láser (SVG)
                    </button>
                  </div>
                </div>)}

              {codigoTransferencia?.idMascota === mascota.id && (<div className="border-t border-sand bg-gold-tint p-3 text-sm text-gold-dark">
                  <p className="mb-2">
                    Comparte este código con el nuevo dueño — solo se muestra una vez y vence en 24 horas. Lo canjea desde su
                    propia cuenta en &quot;Tengo un código de transferencia&quot;.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-paper-raised px-2 py-1 font-mono text-xs">{codigoTransferencia.combinado}</code>
                    <button type="button" onClick={() => copiarCodigoTransferencia(codigoTransferencia.combinado)} className="flex min-h-9 items-center gap-1 whitespace-nowrap text-gold-dark underline hover:no-underline">
                      {transferenciaCopiada ? <Check className="h-3.5 w-3.5"/> : <Copy className="h-3.5 w-3.5"/>}
                      {transferenciaCopiada ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>)}
            </div>))}
        </div>

        <div className="shadow-soft mb-8 rounded-xl border border-sand bg-paper-raised p-4 sm:p-5">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Tengo un código de transferencia</h2>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => {
            e.preventDefault();
            canjearTransferencia.mutate(entradaCanje);
        }}>
            <input className="min-h-11 flex-1 rounded-md border border-sand-dark px-3 text-sm font-mono focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" placeholder="Pega aquí el código que te compartió el dueño anterior" value={entradaCanje} onChange={(e) => setEntradaCanje(e.target.value)}/>
            <button type="submit" disabled={canjearTransferencia.isPending || !entradaCanje} className="min-h-11 rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50">
              {canjearTransferencia.isPending ? "Canjeando..." : "Canjear"}
            </button>
          </form>
          {canjearTransferencia.isError && (<p className="mt-2 text-sm text-clay-dark">{canjearTransferencia.error.message}</p>)}
          {canjearTransferencia.isSuccess && <p className="mt-2 text-sm text-pine">Mascota transferida a tu cuenta.</p>}
        </div>

        <div className="shadow-soft rounded-xl border border-sand bg-paper-raised p-4 sm:p-5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">
              {modoFormulario === "camada" ? "Registrar camada" : modoFormulario === "masiva" ? "Carga masiva de albergue" : "Registrar nueva mascota"}
            </h2>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {modoFormulario !== "individual" && (<button type="button" onClick={() => setModoFormulario("individual")} className="min-h-9 text-ink-soft hover:text-ink">
                  Registrar una sola mascota
                </button>)}
              {modoFormulario !== "camada" && (<button type="button" onClick={() => setModoFormulario("camada")} className="min-h-9 text-ink-soft hover:text-ink">
                  ¿Es una camada?
                </button>)}
              {modoFormulario !== "masiva" && (<button type="button" onClick={() => setModoFormulario("masiva")} className="min-h-9 text-ink-soft hover:text-ink">
                  ¿Eres un albergue?
                </button>)}
            </div>
          </div>

          {modoFormulario === "masiva" ? (<div className="space-y-3">
              <p className="text-sm text-ink-soft">
                Hasta 100 mascotas por carga, una por línea: <code className="rounded bg-paper px-1 font-mono">nombre,especie</code>. Se
                procesan en segundo plano — te avisamos por correo cuando termine.
              </p>
              <textarea className="h-40 w-full rounded-md border border-sand-dark px-3 py-2 font-mono text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" placeholder={"Firulais,perro\nMishi,gato\nRocky,perro"} value={textoMasivo} onChange={(e) => setTextoMasivo(e.target.value)}/>
              <p className="text-xs text-ink-faint">
                {mascotasMasivas.length} mascota(s) detectada(s) {mascotasMasivas.length > 100 && "— supera el máximo de 100"}
              </p>
              {cargarMasiva.isError && <p className="text-sm text-clay-dark">{cargarMasiva.error.message}</p>}
              {cargarMasiva.isSuccess && (<p className="text-sm text-pine">
                  Se encolaron {cargarMasiva.data.encolados} mascotas. Te avisaremos por correo cuando el proceso termine.
                </p>)}
              <button type="button" onClick={() => cargarMasiva.mutate(mascotasMasivas)} disabled={cargarMasiva.isPending || mascotasMasivas.length === 0 || mascotasMasivas.length > 100} className="min-h-12 w-full rounded-md bg-pine font-medium text-white hover:bg-pine-dark disabled:opacity-50 sm:w-auto sm:px-6">
                {cargarMasiva.isPending ? "Enviando..." : `Cargar ${mascotasMasivas.length} mascotas`}
              </button>
            </div>) : modoFormulario === "camada" ? (<form className="space-y-3" onSubmit={manejarEnvioCamada((values) => crearCamada.mutate(values))}>
              <div className="space-y-2">
                {camposCamada.map((campo, index) => (<div key={campo.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <div>
                      <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" placeholder="Nombre" {...registrarCampoCamada(`mascotas.${index}.nombre`)}/>
                      {erroresCamada.mascotas?.[index]?.nombre && (<p className="mt-1 text-xs text-clay-dark">{erroresCamada.mascotas[index]?.nombre?.message}</p>)}
                    </div>
                    <div>
                      <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" placeholder="Especie (perro, gato...)" {...registrarCampoCamada(`mascotas.${index}.especie`)}/>
                      {erroresCamada.mascotas?.[index]?.especie && (<p className="mt-1 text-xs text-clay-dark">{erroresCamada.mascotas[index]?.especie?.message}</p>)}
                    </div>
                    <button type="button" onClick={() => quitarCriaCamada(index)} disabled={camposCamada.length <= 1} title="Quitar" className="flex min-h-11 items-center justify-center rounded-md border border-sand-dark text-ink-soft hover:bg-paper disabled:opacity-30 sm:w-11">
                      <Trash2 className="h-4 w-4"/>
                    </button>
                  </div>))}
              </div>

              <button type="button" onClick={() => agregarCriaCamada({ nombre: "", especie: "" })} disabled={camposCamada.length >= 8} className="flex min-h-11 items-center gap-1 text-sm text-ink-soft hover:text-ink disabled:opacity-40">
                <Plus className="h-4 w-4"/> Agregar otra cría {camposCamada.length >= 8 && "(máximo 8)"}
              </button>

              <div>
                {crearCamada.isError && <p className="mb-2 text-sm text-clay-dark">{crearCamada.error.message}</p>}
                <button type="submit" disabled={crearCamada.isPending} className="min-h-12 w-full rounded-md bg-pine font-medium text-white hover:bg-pine-dark disabled:opacity-50 sm:w-auto sm:px-6">
                  {crearCamada.isPending ? "Guardando..." : `Registrar ${camposCamada.length} mascotas`}
                </button>
              </div>
            </form>) : (<form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit((values) => crearMascota.mutate(values))}>
              <div className="flex flex-col items-center gap-1 pb-3 sm:col-span-2">
                <SelectorFotoMascota urlFoto={fotoNueva?.vistaPrevia} nombre="la mascota" alElegir={elegirFotoNueva} tamano="lg"/>
                <p className="text-xs text-ink-faint">Foto opcional — saldrá en la ficha que se abre con el QR</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Nombre</label>
                <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("nombre")}/>
                {errors.nombre && <p className="mt-1 text-xs text-clay-dark">{errors.nombre.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Especie</label>
                <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" placeholder="perro, gato..." {...register("especie")}/>
                {errors.especie && <p className="mt-1 text-xs text-clay-dark">{errors.especie.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Raza (opcional)</label>
                <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("raza")}/>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Sexo (opcional)</label>
                <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("sexo")}/>
              </div>
              <div className="sm:col-span-2">
                {crearMascota.isError && <p className="mb-2 text-sm text-clay-dark">{crearMascota.error.message}</p>}
                {errorFotoNueva && <p role="alert" className="mb-2 text-sm text-clay-dark">{errorFotoNueva}</p>}
                <button type="submit" disabled={crearMascota.isPending} className="min-h-12 w-full rounded-md bg-pine font-medium text-white hover:bg-pine-dark disabled:opacity-50 sm:w-auto sm:px-6">
                  {crearMascota.isPending ? "Guardando..." : "Registrar mascota"}
                </button>
              </div>
            </form>)}
        </div>
      </main>
    </div>);
}
