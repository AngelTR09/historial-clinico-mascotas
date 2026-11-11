import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { esquemaCreacionEventoSaludVeterinario } from "@hcm/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "../../api/client";
import { etiquetaTipoEvento, TIPOS_EVENTO_SALUD } from "../../lib/event-types";
import { entrada } from "../../lib/entrada";
import { Entrada } from "../ui/campo";
import { HACE_7_DIAS, HOY } from "../../lib/fechas";
import { Aviso } from "../ui/aviso";
import { claseBoton } from "../ui/boton";
// La clave de idempotencia no es un campo del formulario: nace al capturar y se agrega al enviar.
const esquemaFormulario = esquemaCreacionEventoSaludVeterinario.omit({ claveIdempotencia: true, corrigeEventoId: true });
const hoyLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const valoresIniciales = () => ({ tipo: "chequeo", fechaEvento: hoyLocal(), textoOriginal: "" });
const CLASE_CAMPO = "w-full min-h-11 rounded-md border border-border-strong px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus";
/**
 * RN 3: el veterinario registra directamente lo que atiende (atención, vacuna,
 * desparasitación). El evento nace verificado. La `claveIdempotencia` se genera al
 * capturar y solo cambia cuando el registro se confirma, así reintentar un envío que
 * se cortó no lo duplica (RN 6).
 */
export function FormularioRegistroVeterinario({ idMascota, tokenAcceso, alRegistrar }) {
    const [claveIdempotencia, setClaveIdempotencia] = useState(() => crypto.randomUUID());
    const { register, handleSubmit, reset, trigger, formState: { errors }, } = useForm({ resolver: zodResolver(esquemaFormulario), defaultValues: valoresIniciales() });
    const registrar = useMutation({
        mutationFn: (valores) => api.post(`/pets/${idMascota}/health-events`, { ...valores, claveIdempotencia }, { token: tokenAcceso }),
        onSuccess: () => {
            setClaveIdempotencia(crypto.randomUUID());
            reset(valoresIniciales());
            alRegistrar?.();
        },
    });
    return (<form className="mb-8 grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2" onSubmit={handleSubmit((valores) => registrar.mutate(valores))} aria-label="Registrar atención">
      <div>
        <label htmlFor="vet-tipo" className="mb-2 block text-sm font-medium text-ink">Tipo</label>
        <select id="vet-tipo" className={CLASE_CAMPO} {...register("tipo")}>
          {TIPOS_EVENTO_SALUD.map((tipo) => (<option key={tipo} value={tipo} className="capitalize">{etiquetaTipoEvento(tipo)}</option>))}
        </select>
      </div>
      <div>
        <label htmlFor="vet-fecha" className="mb-2 block text-sm font-medium text-ink">Fecha</label>
        <input id="vet-fecha" type="date" max={HOY} min={HACE_7_DIAS} className={CLASE_CAMPO} {...register("fechaEvento", { onChange: () => trigger("fechaEvento") })}/>
        {errors.fechaEvento && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.fechaEvento.message}</p>}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="vet-texto" className="mb-2 block text-sm font-medium text-ink">Detalle</label>
        <Entrada id="vet-texto" className={CLASE_CAMPO} placeholder="Antirrábica, control anual, desparasitación interna…" {...register("textoOriginal")} {...entrada("textoEvento")}/>
        {errors.textoOriginal && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.textoOriginal.message}</p>}
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={registrar.isPending} className={claseBoton({ tamano: "lg", bloque: "movil" })}>
          {registrar.isPending ? "Registrando…" : "Registrar"}
        </button>
        {registrar.isError && <Aviso variante="peligro" className="mt-3"><p>{registrar.error.message}</p></Aviso>}
        {registrar.isSuccess && <Aviso variante="info" className="mt-3"><p>Registrado: queda verificado en el expediente.</p></Aviso>}
      </div>
    </form>);
}
