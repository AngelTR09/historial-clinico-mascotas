import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { esquemaCreacionEventoSaludVeterinario } from "@hcm/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "../../api/client";
import { etiquetaTipoEvento, TIPOS_EVENTO_SALUD } from "../../lib/event-types";
// La clave de idempotencia no es un campo del formulario: nace al capturar y se agrega al enviar.
const esquemaFormulario = esquemaCreacionEventoSaludVeterinario.omit({ claveIdempotencia: true, corrigeEventoId: true });
const hoyLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const valoresIniciales = () => ({ tipo: "chequeo", fechaEvento: hoyLocal(), textoOriginal: "" });
const CLASE_CAMPO = "w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";
/**
 * RN 3: el veterinario registra directamente lo que atiende (atención, vacuna,
 * desparasitación). El evento nace verificado. La `claveIdempotencia` se genera al
 * capturar y solo cambia cuando el registro se confirma, así reintentar un envío que
 * se cortó no lo duplica (RN 6).
 */
export function FormularioRegistroVeterinario({ idMascota, tokenAcceso, alRegistrar }) {
    const [claveIdempotencia, setClaveIdempotencia] = useState(() => crypto.randomUUID());
    const { register, handleSubmit, reset, formState: { errors }, } = useForm({ resolver: zodResolver(esquemaFormulario), defaultValues: valoresIniciales() });
    const registrar = useMutation({
        mutationFn: (valores) => api.post(`/pets/${idMascota}/health-events`, { ...valores, claveIdempotencia }, { token: tokenAcceso }),
        onSuccess: () => {
            setClaveIdempotencia(crypto.randomUUID());
            reset(valoresIniciales());
            alRegistrar?.();
        },
    });
    return (<form className="mb-8 grid grid-cols-1 gap-3 rounded-xl border border-sand bg-paper-raised p-4 sm:grid-cols-2" onSubmit={handleSubmit((valores) => registrar.mutate(valores))} aria-label="Registrar atención">
      <div>
        <label htmlFor="vet-tipo" className="mb-1 block text-sm font-medium text-ink">Tipo</label>
        <select id="vet-tipo" className={CLASE_CAMPO} {...register("tipo")}>
          {TIPOS_EVENTO_SALUD.map((tipo) => (<option key={tipo} value={tipo} className="capitalize">{etiquetaTipoEvento(tipo)}</option>))}
        </select>
      </div>
      <div>
        <label htmlFor="vet-fecha" className="mb-1 block text-sm font-medium text-ink">Fecha</label>
        <input id="vet-fecha" type="date" className={CLASE_CAMPO} {...register("fechaEvento")}/>
        {errors.fechaEvento && <p className="mt-1 text-xs text-clay-dark">{errors.fechaEvento.message}</p>}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="vet-texto" className="mb-1 block text-sm font-medium text-ink">Detalle</label>
        <input id="vet-texto" className={CLASE_CAMPO} placeholder="Antirrábica, control anual, desparasitación interna…" {...register("textoOriginal")}/>
        {errors.textoOriginal && <p className="mt-1 text-xs text-clay-dark">{errors.textoOriginal.message}</p>}
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={registrar.isPending} className="min-h-11 rounded-md bg-pine px-4 text-sm font-medium text-white hover:bg-pine-dark disabled:opacity-50">
          {registrar.isPending ? "Registrando…" : "Registrar"}
        </button>
        {registrar.isError && <p role="alert" className="mt-2 text-sm text-clay-dark">{registrar.error.message}</p>}
        {registrar.isSuccess && <p role="status" className="mt-2 text-sm text-pine-dark">Registrado: queda verificado en el expediente.</p>}
      </div>
    </form>);
}
