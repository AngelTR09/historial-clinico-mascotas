import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { esquemaActualizacionMascota, LIMITE_ALERTAS_MEDICAS, LIMITE_COLOR_SENAS, LIMITE_NOTA_DEL_DUENO, LIMITE_TEMPERAMENTO } from "@hcm/shared";
import { AlertTriangle, Eye, HeartPulse, ShieldAlert } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { api } from "../../api/client";

const CLASE_CAMPO = "w-full min-h-11 rounded-md border border-sand-dark px-3 text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

/** El <select> maneja cadenas; el esquema espera true / false / null (sin dato). */
const aCadenaEsterilizada = (valor) => (valor === true ? "si" : valor === false ? "no" : "");
const desdeCadenaEsterilizada = (valor) => (valor === "si" ? true : valor === "no" ? false : null);

const resolverEsquema = zodResolver(esquemaActualizacionMascota);
/** Convierte la cadena del <select> antes de validar; así el formulario maneja cadenas y el esquema, booleanos. */
const resolverConEsterilizada = (valores, contexto, opciones) => resolverEsquema({ ...valores, esterilizada: desdeCadenaEsterilizada(valores.esterilizada) }, contexto, opciones);

function valoresIniciales(mascota) {
    return {
        colorSenas: mascota.colorSenas ?? "",
        esterilizada: aCadenaEsterilizada(mascota.esterilizada),
        alertasMedicas: mascota.alertasMedicas ?? "",
        alertasMedicasPublicas: mascota.alertasMedicasPublicas,
        temperamento: mascota.temperamento ?? "",
        notaDelDueno: mascota.notaDelDueno ?? "",
    };
}

function Campo({ etiqueta, error, contador, children }) {
    return (<div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="block text-sm font-medium text-ink">{etiqueta}</label>
        {contador && <span className="text-xs text-ink-faint">{contador}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-xs text-clay-dark">{error.message}</p>}
    </div>);
}

/**
 * Datos que el dueño rellena para que quien encuentre a la mascota pueda
 * identificarla y cuidarla. Todo lo de esta pantalla es público al escanear el
 * QR, salvo las alertas médicas, que solo se publican si el dueño lo autoriza.
 */
export function FormularioDatosPublicosMascota({ mascota }) {
    const queryClient = useQueryClient();
    const { register, handleSubmit, reset, control, formState: { errors, isDirty }, } = useForm({
        resolver: resolverConEsterilizada,
        defaultValues: valoresIniciales(mascota),
    });
    const guardar = useMutation({
        mutationFn: (datos) => api.patch(`/pets/${mascota.id}`, datos),
        onSuccess: (actualizada) => {
            reset(valoresIniciales(actualizada));
            queryClient.invalidateQueries({ queryKey: ["pets"] });
        },
    });
    // useWatch (no watch()) para que el React Compiler pueda memoizar el componente.
    const valores = useWatch({ control });
    const esterilizadaVista = desdeCadenaEsterilizada(valores.esterilizada);
    const filasVistaPrevia = [
        ["Color y señas", valores.colorSenas?.trim()],
        ["Temperamento", valores.temperamento?.trim()],
        ["Esterilizada", esterilizadaVista === null ? null : esterilizadaVista ? "Sí" : "No"],
        ["Nota del dueño", valores.notaDelDueno?.trim()],
    ].filter(([, valor]) => valor);
    const alertaVisible = valores.alertasMedicasPublicas && valores.alertasMedicas?.trim();

    return (<section className="mb-8 rounded-xl border border-sand bg-paper-raised p-4">
      <h2 className="font-display text-lg font-semibold text-ink">Datos para la ficha pública</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Cualquiera que escanee el QR de la placa verá estos datos básicos para identificar a {mascota.nombre}. El expediente completo solo lo abre un veterinario aprobado.
      </p>
      <p className="mb-4 flex items-start gap-2 rounded-md bg-clay-tint p-2 text-xs text-clay-dark">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0"/>
        No pongas teléfono, correo ni dirección: el contacto se hace por el formulario de la ficha.
      </p>

      <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit((datos) => guardar.mutate(datos))} noValidate>
        <div className="sm:col-span-2">
          <Campo etiqueta="Color y señas particulares" error={errors.colorSenas} contador={`${valores.colorSenas?.length ?? 0}/${LIMITE_COLOR_SENAS}`}>
            <input className={CLASE_CAMPO} placeholder="Manchas blancas en el pecho, oreja caída" {...register("colorSenas")}/>
          </Campo>
        </div>
        <Campo etiqueta="Esterilizada" error={errors.esterilizada}>
          <select className={CLASE_CAMPO} {...register("esterilizada")}>
            <option value="">Sin dato</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </Campo>
        <Campo etiqueta="Temperamento" error={errors.temperamento} contador={`${valores.temperamento?.length ?? 0}/${LIMITE_TEMPERAMENTO}`}>
          <input className={CLASE_CAMPO} placeholder="Asustadiza, no le gusta que la carguen" {...register("temperamento")}/>
        </Campo>
        <div className="sm:col-span-2">
          <Campo etiqueta="Alertas médicas críticas" error={errors.alertasMedicas} contador={`${valores.alertasMedicas?.length ?? 0}/${LIMITE_ALERTAS_MEDICAS}`}>
            <input className={CLASE_CAMPO} placeholder="Diabética, alérgica a la penicilina" {...register("alertasMedicas")}/>
          </Campo>
          <label className="mt-2 flex min-h-9 items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-pine" {...register("alertasMedicasPublicas")}/>
            <span>
              Autorizo mostrar las alertas médicas en la ficha pública
              <span className="block text-xs text-ink-soft">Si no lo marcas, quedan guardadas en tu expediente pero nadie que escanee el QR las verá.</span>
            </span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <Campo etiqueta="Nota para quien la encuentre" error={errors.notaDelDueno} contador={`${valores.notaDelDueno?.length ?? 0}/${LIMITE_NOTA_DEL_DUENO}`}>
            <textarea rows={3} maxLength={LIMITE_NOTA_DEL_DUENO + 50} className="w-full rounded-md border border-sand-dark px-3 py-2 text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" placeholder="Come dos veces al día, responde a su nombre..." {...register("notaDelDueno")}/>
          </Campo>
        </div>

        <div className="rounded-md border border-sand bg-paper p-3 sm:col-span-2">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <Eye className="h-4 w-4"/> Así lo verá quien escanee el QR
          </p>
          {alertaVisible && (<p className="mb-2 flex items-start gap-2 rounded-md border border-clay bg-clay-tint p-2 text-sm font-medium text-ink">
              <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-clay-dark"/> {valores.alertasMedicas.trim()}
            </p>)}
          {valores.alertasMedicas?.trim() && !valores.alertasMedicasPublicas && (<p className="mb-2 flex items-start gap-2 text-xs text-ink-soft">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0"/> Las alertas médicas no se mostrarán: falta tu autorización.
            </p>)}
          {filasVistaPrevia.length === 0 && !alertaVisible ? (<p className="text-sm text-ink-faint">Todavía no hay datos que mostrar.</p>) : (<dl className="space-y-1">
              {filasVistaPrevia.map(([etiqueta, valor]) => (<div key={etiqueta} className="flex justify-between gap-4 text-sm">
                  <dt className="shrink-0 text-ink-soft">{etiqueta}</dt>
                  <dd className="text-right font-medium text-ink">{valor}</dd>
                </div>))}
            </dl>)}
        </div>

        <div className="sm:col-span-2">
          {guardar.isError && <p className="mb-2 text-sm text-clay-dark">{guardar.error.message}</p>}
          {guardar.isSuccess && !isDirty && <p className="mb-2 text-sm text-pine-dark">Datos guardados.</p>}
          <button type="submit" disabled={guardar.isPending || !isDirty} className="min-h-12 w-full rounded-md bg-pine font-medium text-white hover:bg-pine-dark disabled:opacity-50 sm:w-auto sm:px-6">
            {guardar.isPending ? "Guardando..." : "Guardar datos"}
          </button>
        </div>
      </form>
    </section>);
}
