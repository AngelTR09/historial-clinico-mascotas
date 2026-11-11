import { useMutation } from "@tanstack/react-query";
import { esquemaRegistroMascotaPorVeterinario, TIPOS_DOCUMENTO } from "@hcm/shared";
import { ArrowLeft, PawPrint } from "lucide-react";
import { cloneElement, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { EncabezadoPaginaVeterinario } from "../../components/vet/vet-page-header";
import { obtenerTokenVeterinario } from "../../lib/auth-storage";
import { claseBoton } from "../../components/ui/boton";
import { EncabezadoSeccion } from "../../components/ui/encabezado-seccion";
import { entrada, entradaDocumento, ETIQUETA_DOCUMENTO } from "../../lib/entrada";
import { Entrada } from "../../components/ui/campo";
import { HACE_30_ANIOS, HOY } from "../../lib/fechas";
import { resolverConDocumento } from "../../lib/resolver-documento";

const CLASE_INPUT = "w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus";

/** Asocia la etiqueta con su campo (lectores de pantalla) inyectando un `id` al único hijo. */
function Campo({ etiqueta, error, children }) {
    const id = useId();
    return (<div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">{etiqueta}</label>
      {cloneElement(children, { id })}
      {error && <p className="mt-2 text-sm font-medium text-clay-ink">{error.message}</p>}
    </div>);
}

/**
 * El veterinario aprobado da de alta a la mascota y a su dueño cuando el dueño no usa el
 * sistema. Al terminar abre el expediente con el mismo acceso de 4 horas que daría el QR.
 */
export function PaginaRegistrarMascotaVeterinario() {
    const navigate = useNavigate();
    const tokenVeterinario = obtenerTokenVeterinario();
    const { register, handleSubmit, control, trigger, formState: { errors } } = useForm({
        resolver: resolverConDocumento(esquemaRegistroMascotaPorVeterinario, "dueno"),
        defaultValues: { dueno: { tipoDocumento: "DNI" } },
    });
    const tipoDocumento = useWatch({ control, name: "dueno.tipoDocumento" }) ?? "DNI";
    const registrar = useMutation({
        mutationFn: (input) => api.post("/vets/pets", input, { token: tokenVeterinario }),
        onSuccess: (datos) => navigate(`/vet/pets/${datos.idMascota}`, { state: { tokenAcceso: datos.token, expiraEn: datos.expiraEn } }),
    });
    const errDueno = errors.dueno ?? {};
    const errMascota = errors.mascota ?? {};
    return (<div className="min-h-screen bg-canvas">
      <EncabezadoPaginaVeterinario mostrarCerrarSesion/>
      <main id="contenido" className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/vet/dashboard" className="mb-4 flex min-h-11 items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4"/> Volver al panel
        </Link>
        <EncabezadoSeccion sobretitulo="Veterinario" titulo="Registrar mascota y dueño" className="mb-4"/>
        <p className="mb-6 text-sm text-ink-soft">
          Para dueños que aún no usan el sistema. Se crea su expediente y puedes registrar la atención de inmediato.
          Cuando el dueño se registre con este mismo documento y correo, tomará el control de su cuenta.
        </p>

        <form className="space-y-6" onSubmit={handleSubmit((valores) => registrar.mutate(valores))} noValidate>
          <section className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5">
            <h2 className="font-display text-lg font-semibold text-ink">Dueño</h2>
            <div className="grid grid-cols-3 gap-3">
              <Campo etiqueta="Documento" error={errDueno.tipoDocumento}>
                <select className={CLASE_INPUT} {...register("dueno.tipoDocumento")}>
                  {TIPOS_DOCUMENTO.map((tipo) => (<option key={tipo} value={tipo}>{ETIQUETA_DOCUMENTO[tipo]}</option>))}
                </select>
              </Campo>
              <div className="col-span-2">
                <Campo etiqueta="Número" error={errDueno.numeroDocumento}>
                  <Entrada className={`${CLASE_INPUT} font-mono`} {...register("dueno.numeroDocumento")} {...entradaDocumento(tipoDocumento)}/>
                </Campo>
              </div>
            </div>
            <Campo etiqueta="Nombres" error={errDueno.nombres}>
              <Entrada className={CLASE_INPUT} {...register("dueno.nombres")} {...entrada("nombrePersona")}/>
            </Campo>
            <Campo etiqueta="Apellidos" error={errDueno.apellidos}>
              <Entrada className={CLASE_INPUT} {...register("dueno.apellidos")} {...entrada("apellidos")}/>
            </Campo>
            <Campo etiqueta="Correo" error={errDueno.correo}>
              <Entrada type="email" className={CLASE_INPUT} {...register("dueno.correo")} {...entrada("correo")}/>
            </Campo>
            <Campo etiqueta="Teléfono (opcional)" error={errDueno.telefono}>
              <Entrada className={CLASE_INPUT} {...register("dueno.telefono")} {...entrada("telefono")} placeholder="944 556 677"/>
            </Campo>
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-pine" {...register("dueno.aceptaTratamientoDatos")}/>
              El dueño autorizó el tratamiento de sus datos personales conforme a la Ley 29733.
            </label>
            {errDueno.aceptaTratamientoDatos && <p className="text-xs text-clay-ink">Debes confirmar la autorización del dueño</p>}
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink"><PawPrint className="h-4 w-4 text-pine"/> Mascota</h2>
            <Campo etiqueta="Nombre" error={errMascota.nombre}>
              <Entrada className={CLASE_INPUT} {...register("mascota.nombre")} {...entrada("nombreMascota")}/>
            </Campo>
            <Campo etiqueta="Especie" error={errMascota.especie}>
              <Entrada className={CLASE_INPUT} placeholder="perro, gato..." {...register("mascota.especie")} {...entrada("especie")}/>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Raza (opcional)" error={errMascota.raza}>
                <Entrada className={CLASE_INPUT} {...register("mascota.raza")} {...entrada("raza")}/>
              </Campo>
              <Campo etiqueta="Sexo (opcional)" error={errMascota.sexo}>
                <select className={CLASE_INPUT} {...register("mascota.sexo")}>
                  <option value="">Sin dato</option>
                  <option value="macho">Macho</option>
                  <option value="hembra">Hembra</option>
                </select>
              </Campo>
            </div>
            <Campo etiqueta="Nacimiento aproximado (opcional)" error={errMascota.fechaNacimientoAprox}>
              <input type="date" max={HOY} min={HACE_30_ANIOS} className={CLASE_INPUT} {...register("mascota.fechaNacimientoAprox", { onChange: () => trigger("mascota.fechaNacimientoAprox") })}/>
            </Campo>
          </section>

          {registrar.isError && <p role="alert" className="text-sm text-clay-ink">{registrar.error.message}</p>}
          <button type="submit" disabled={registrar.isPending} className={claseBoton({ tamano: "lg", bloque: true })}>
            {registrar.isPending ? "Registrando..." : "Registrar y abrir expediente"}
          </button>
        </form>
      </main>
    </div>);
}
