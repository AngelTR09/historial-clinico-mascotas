import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { esquemaCreacionCamada, esquemaCreacionMascota } from "@hcm/shared";
import { Plus, Trash2 } from "lucide-react";
import { descargarSvgPlacaQr, generarSvgPlacaQr } from "../../lib/qr-placa";
import { useFieldArray, useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { api, ErrorApi } from "../../api/client";
import { AvisoError } from "../../components/ui/error-banner";
import { EsqueletoLista } from "../../components/ui/list-skeleton";
import { SelectorFotoMascota } from "../../components/pets/pet-photo-picker";
import { EncabezadoPagina } from "../../components/ui/page-header";
import { prepararFotoMascota, subirFotoMascota } from "../../lib/pet-photo";
import { claseBoton } from "../../components/ui/boton";
import { Aviso } from "../../components/ui/aviso";
import { Panel, PanelCabecera, PanelCuerpo } from "../../components/ui/panel";
import { TarjetaMascota } from "../../components/pets/pet-card";
import { EncabezadoSeccion } from "../../components/ui/encabezado-seccion";
import { entrada } from "../../lib/entrada";
import { Entrada } from "../../components/ui/campo";
export function PaginaPanel() {
    const queryClient = useQueryClient();
    const [idMascotaCopiada, setIdMascotaCopiada] = useState(null);
    // Acordeón: un solo panel abierto en todo el dashboard (el QR o la transferencia de una mascota). Abrir uno cierra el otro.
    const [panelAbierto, setPanelAbierto] = useState(null);
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
    // Un código por mascota: el servidor solo guarda su hash, así que si se pierde de pantalla no se puede volver a ver.
    const [codigosTransferencia, setCodigosTransferencia] = useState({});
    const [errorTransferencia, setErrorTransferencia] = useState(null);
    const [transferenciaCopiada, setTransferenciaCopiada] = useState(false);
    const crearTransferencia = useMutation({
        mutationFn: ({ idMascota, reemplazar }) => api.post("/transfers", { idMascota, ...(reemplazar ? { reemplazar: true } : {}) }),
        onMutate: () => setErrorTransferencia(null),
        onSuccess: (resultado) => {
            setCodigosTransferencia((previos) => ({ ...previos, [resultado.transferencia.idMascota]: `${resultado.transferencia.id}:${resultado.codigo}` }));
            setTransferenciaCopiada(false);
        },
        onError: (error, { idMascota }) => setErrorTransferencia({ idMascota, mensaje: error.message, hayPendiente: error.status === 409 }),
    });
    function alternarTransferencia(idMascota) {
        if (panelAbierto?.idMascota === idMascota && panelAbierto.tipo === "transferencia") {
            setPanelAbierto(null);
            return;
        }
        setPanelAbierto({ idMascota, tipo: "transferencia" });
        // Si el código de esta sesión sigue a mano se vuelve a mostrar; el servidor ya no puede devolverlo.
        if (!codigosTransferencia[idMascota]) {
            crearTransferencia.mutate({ idMascota });
        }
    }
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
    return (<div className="min-h-screen bg-canvas">
      <EncabezadoPagina mostrarCerrarSesion/>
      <main id="contenido" className="mx-auto max-w-page px-4 py-6 sm:px-6 sm:py-8">
        <EncabezadoSeccion sobretitulo="Dueño" titulo="Mis mascotas" descripcion="Expedientes de salud y placas QR de tus mascotas."/>

        {!!consultaRecordatorios.data?.length && (<Aviso variante="info" titulo="Vacunas y desparasitaciones por vencer" className="mb-6">
            <ul className="space-y-1">
              {consultaRecordatorios.data.map((recordatorio) => (<li key={`${recordatorio.idMascota}-${recordatorio.vacuna}`}>
                  <span className="font-medium">{recordatorio.nombreMascota}</span> · {recordatorio.vacuna} · vence el{" "}
                  {recordatorio.vencimiento}
                </li>))}
            </ul>
          </Aviso>)}

        <div className="mb-8 grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3 [&>:not(article)]:col-span-full">
          {consultaMascotas.isLoading && <EsqueletoLista />}
          {consultaMascotas.isError && (<AvisoError mensaje="No se pudo cargar tu lista de mascotas." alReintentar={() => consultaMascotas.refetch()}/>)}
          {consultaMascotas.data?.length === 0 && (<div className="rise flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
              <img src="/img/vacio-gato.webp" alt="" width="640" height="640" loading="lazy" className="mb-3 h-24 w-24 rounded-full object-cover object-[50%_35%] ring-4 ring-surface shadow-sm"/>
              <p className="font-display text-2xl font-semibold text-ink">Aún no hay mascotas</p>
              <p className="mt-1 max-w-xs text-sm text-ink-soft">Registra a tu primera mascota con el formulario de abajo para crear su expediente y su placa QR.</p>
            </div>)}
          {consultaMascotas.data?.map((mascota, indice) => {
            const urlFicha = `/p/${mascota.tokenQr}`;
            const urlAbsoluta = `${window.location.origin}${urlFicha}`;
            return (<TarjetaMascota key={mascota.id} mascota={mascota} indice={indice} qrVisible={panelAbierto?.idMascota === mascota.id && panelAbierto.tipo === "qr"} transferenciaVisible={panelAbierto?.idMascota === mascota.id && panelAbierto.tipo === "transferencia"} tokenCopiado={idMascotaCopiada === mascota.id} estadoOcupado={actualizarEstado.isPending} transferenciaOcupada={crearTransferencia.isPending} codigoTransferencia={codigosTransferencia[mascota.id] ?? null} errorTransferencia={errorTransferencia?.idMascota === mascota.id ? errorTransferencia : null} transferenciaCopiada={transferenciaCopiada} urlFicha={urlFicha} urlImagenQr={`data:image/svg+xml;utf8,${encodeURIComponent(generarSvgPlacaQr(urlAbsoluta))}`} alCambiarEstado={() => actualizarEstado.mutate({ idMascota: mascota.id, estado: mascota.estado === "extraviada" ? "activa" : "extraviada" })} alCopiarToken={() => copiarTokenQr(mascota.id, mascota.tokenQr)} alAlternarQr={() => setPanelAbierto(panelAbierto?.idMascota === mascota.id && panelAbierto.tipo === "qr" ? null : { idMascota: mascota.id, tipo: "qr" })} alDescargarQr={() => descargarSvgPlacaQr(urlAbsoluta, `placa-qr-${mascota.nombre}`)} alTransferir={() => alternarTransferencia(mascota.id)} alReemplazarTransferencia={() => crearTransferencia.mutate({ idMascota: mascota.id, reemplazar: true })} alCopiarTransferencia={() => copiarCodigoTransferencia(codigosTransferencia[mascota.id])}/>);
        })}
        </div>

        <Panel className="mx-auto mb-8 max-w-reading">
          <PanelCabecera titulo="Tengo un código de transferencia"/>
          <PanelCuerpo>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => {
            e.preventDefault();
            canjearTransferencia.mutate(entradaCanje);
        }}>
            <Entrada className="min-h-11 flex-1 rounded-md border border-control-border px-3 text-sm font-mono bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" placeholder="Pega aquí el código que te compartió el dueño anterior" {...entrada("codigoTransferencia")} value={entradaCanje} onChange={(e) => setEntradaCanje(e.target.value)}/>
            <button type="submit" disabled={canjearTransferencia.isPending || !entradaCanje} className={claseBoton({})}>
              {canjearTransferencia.isPending ? "Canjeando..." : "Canjear"}
            </button>
          </form>
          {canjearTransferencia.isError && (<p className="mt-2 text-sm text-clay-ink">{canjearTransferencia.error.message}</p>)}
          {canjearTransferencia.isSuccess && <p className="mt-2 text-sm font-medium text-pine-ink">Mascota transferida a tu cuenta.</p>}
          </PanelCuerpo>
        </Panel>

        <Panel className="mx-auto max-w-reading">
          <PanelCabecera>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">
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
          </PanelCabecera>
          <PanelCuerpo>
          {modoFormulario === "masiva" ? (<div className="space-y-3">
              <p className="text-sm text-ink-soft">
                Hasta 100 mascotas por carga, una por línea: <code className="rounded bg-canvas px-1 font-mono">nombre,especie</code>. Se
                procesan en segundo plano — te avisamos por correo cuando termine.
              </p>
              <Entrada comoEtiqueta="textarea" className="h-40 w-full rounded-md border border-control-border px-3 py-2 font-mono text-sm bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" placeholder={"Firulais,perro\nMishi,gato\nRocky,perro"} maxLength={6000} value={textoMasivo} onChange={(e) => setTextoMasivo(e.target.value)}/>
              <p className="text-xs text-ink-faint">
                {mascotasMasivas.length} mascota(s) detectada(s) {mascotasMasivas.length > 100 && "— supera el máximo de 100"}
              </p>
              {cargarMasiva.isError && <p className="text-sm text-clay-ink">{cargarMasiva.error.message}</p>}
              {cargarMasiva.isSuccess && (<p className="text-sm text-pine">
                  Se encolaron {cargarMasiva.data.encolados} mascotas. Te avisaremos por correo cuando el proceso termine.
                </p>)}
              <button type="button" onClick={() => cargarMasiva.mutate(mascotasMasivas)} disabled={cargarMasiva.isPending || mascotasMasivas.length === 0 || mascotasMasivas.length > 100} className={claseBoton({ tamano: "lg", bloque: "movil" })}>
                {cargarMasiva.isPending ? "Enviando..." : `Cargar ${mascotasMasivas.length} mascotas`}
              </button>
            </div>) : modoFormulario === "camada" ? (<form className="space-y-3" onSubmit={manejarEnvioCamada((values) => crearCamada.mutate(values))}>
              <div className="space-y-2">
                {camposCamada.map((campo, index) => (<div key={campo.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <div>
                      <Entrada className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" placeholder="Nombre" {...registrarCampoCamada(`mascotas.${index}.nombre`)} {...entrada("nombreMascota")}/>
                      {erroresCamada.mascotas?.[index]?.nombre && (<p className="mt-2 text-sm font-medium text-clay-ink">{erroresCamada.mascotas[index]?.nombre?.message}</p>)}
                    </div>
                    <div>
                      <Entrada className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" placeholder="Especie (perro, gato...)" {...registrarCampoCamada(`mascotas.${index}.especie`)} {...entrada("especie")}/>
                      {erroresCamada.mascotas?.[index]?.especie && (<p className="mt-2 text-sm font-medium text-clay-ink">{erroresCamada.mascotas[index]?.especie?.message}</p>)}
                    </div>
                    <button type="button" onClick={() => quitarCriaCamada(index)} disabled={camposCamada.length <= 1} title="Quitar" className="flex min-h-11 items-center justify-center rounded-md border border-border-strong text-ink-soft hover:bg-canvas disabled:opacity-30 sm:w-11">
                      <Trash2 className="h-4 w-4"/>
                    </button>
                  </div>))}
              </div>

              <button type="button" onClick={() => agregarCriaCamada({ nombre: "", especie: "" })} disabled={camposCamada.length >= 8} className="flex min-h-11 items-center gap-1 text-sm text-ink-soft hover:text-ink disabled:opacity-40">
                <Plus className="h-4 w-4"/> Agregar otra cría {camposCamada.length >= 8 && "(máximo 8)"}
              </button>

              <div>
                {crearCamada.isError && <p className="mb-2 text-sm text-clay-ink">{crearCamada.error.message}</p>}
                <button type="submit" disabled={crearCamada.isPending} className={claseBoton({ tamano: "lg", bloque: "movil" })}>
                  {crearCamada.isPending ? "Guardando..." : `Registrar ${camposCamada.length} mascotas`}
                </button>
              </div>
            </form>) : (<form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit((values) => crearMascota.mutate(values))}>
              <div className="flex flex-col items-center gap-1 pb-3 sm:col-span-2">
                <SelectorFotoMascota urlFoto={fotoNueva?.vistaPrevia} nombre="la mascota" alElegir={elegirFotoNueva} tamano="lg"/>
                <p className="text-xs text-ink-faint">Foto opcional — saldrá en la ficha que se abre con el QR</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">Nombre</label>
                <Entrada className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("nombre")} {...entrada("nombreMascota")}/>
                {errors.nombre && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.nombre.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">Especie</label>
                <Entrada className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" placeholder="perro, gato..." {...register("especie")} {...entrada("especie")}/>
                {errors.especie && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.especie.message}</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">Raza (opcional)</label>
                <Entrada className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("raza")} {...entrada("raza")}/>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">Sexo (opcional)</label>
                <select className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("sexo")}>
                  <option value="">Sin dato</option>
                  <option value="macho">Macho</option>
                  <option value="hembra">Hembra</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                {crearMascota.isError && <p className="mb-2 text-sm text-clay-ink">{crearMascota.error.message}</p>}
                {errorFotoNueva && <p role="alert" className="mb-2 text-sm text-clay-ink">{errorFotoNueva}</p>}
                <button type="submit" disabled={crearMascota.isPending} className={claseBoton({ tamano: "lg", bloque: "movil" })}>
                  {crearMascota.isPending ? "Guardando..." : "Registrar mascota"}
                </button>
              </div>
            </form>)}
          </PanelCuerpo>
        </Panel>
      </main>
    </div>);
}
