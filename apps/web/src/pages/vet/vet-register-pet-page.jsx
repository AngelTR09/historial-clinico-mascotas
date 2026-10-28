import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { esquemaRegistroMascotaPorVeterinario, TIPOS_DOCUMENTO } from "@hcm/shared";
import { ArrowLeft, PawPrint } from "lucide-react";
import { cloneElement, useId } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { EncabezadoPaginaVeterinario } from "../../components/vet/vet-page-header";
import { obtenerTokenVeterinario } from "../../lib/auth-storage";

const CLASE_INPUT = "w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

/** Asocia la etiqueta con su campo (lectores de pantalla) inyectando un `id` al único hijo. */
function Campo({ etiqueta, error, children }) {
    const id = useId();
    return (<div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">{etiqueta}</label>
      {cloneElement(children, { id })}
      {error && <p className="mt-1 text-xs text-clay-dark">{error.message}</p>}
    </div>);
}

/**
 * El veterinario aprobado da de alta a la mascota y a su dueño cuando el dueño no usa el
 * sistema. Al terminar abre el expediente con el mismo acceso de 4 horas que daría el QR.
 */
export function PaginaRegistrarMascotaVeterinario() {
    const navigate = useNavigate();
    const tokenVeterinario = obtenerTokenVeterinario();
    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(esquemaRegistroMascotaPorVeterinario),
        defaultValues: { dueno: { tipoDocumento: "DNI" } },
    });
    const registrar = useMutation({
        mutationFn: (input) => api.post("/vets/pets", input, { token: tokenVeterinario }),
        onSuccess: (datos) => navigate(`/vet/pets/${datos.idMascota}`, { state: { tokenAcceso: datos.token, expiraEn: datos.expiraEn } }),
    });
    const errDueno = errors.dueno ?? {};
    const errMascota = errors.mascota ?? {};
    return (<div className="min-h-screen bg-paper">
      <EncabezadoPaginaVeterinario mostrarCerrarSesion/>
      <main id="contenido" className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/vet/dashboard" className="mb-4 flex min-h-11 items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4"/> Volver al panel
        </Link>
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Registrar mascota y dueño</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Para dueños que aún no usan el sistema. Se crea su expediente y puedes registrar la atención de inmediato.
          Cuando el dueño se registre con este mismo documento y correo, tomará el control de su cuenta.
        </p>

        <form className="space-y-6" onSubmit={handleSubmit((valores) => registrar.mutate(valores))} noValidate>
          <section className="space-y-3 rounded-xl border border-sand bg-white p-4">
            <h2 className="font-display text-lg font-semibold text-ink">Dueño</h2>
            <div className="grid grid-cols-3 gap-3">
              <Campo etiqueta="Documento" error={errDueno.tipoDocumento}>
                <select className={CLASE_INPUT} {...register("dueno.tipoDocumento")}>
                  {TIPOS_DOCUMENTO.map((tipo) => (<option key={tipo} value={tipo}>{tipo}</option>))}
                </select>
              </Campo>
              <div className="col-span-2">
                <Campo etiqueta="Número" error={errDueno.numeroDocumento}>
                  <input inputMode="numeric" className={`${CLASE_INPUT} font-mono`} {...register("dueno.numeroDocumento")}/>
                </Campo>
              </div>
            </div>
            <Campo etiqueta="Nombres" error={errDueno.nombres}>
              <input className={CLASE_INPUT} {...register("dueno.nombres")}/>
            </Campo>
            <Campo etiqueta="Apellidos" error={errDueno.apellidos}>
              <input className={CLASE_INPUT} {...register("dueno.apellidos")}/>
            </Campo>
            <Campo etiqueta="Correo" error={errDueno.correo}>
              <input type="email" className={CLASE_INPUT} {...register("dueno.correo")}/>
            </Campo>
            <Campo etiqueta="Teléfono (opcional)" error={errDueno.telefono}>
              <input className={CLASE_INPUT} {...register("dueno.telefono")}/>
            </Campo>
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-pine" {...register("dueno.aceptaTratamientoDatos")}/>
              El dueño autorizó el tratamiento de sus datos personales conforme a la Ley 29733.
            </label>
            {errDueno.aceptaTratamientoDatos && <p className="text-xs text-clay-dark">Debes confirmar la autorización del dueño</p>}
          </section>

          <section className="space-y-3 rounded-xl border border-sand bg-white p-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink"><PawPrint className="h-4 w-4 text-pine"/> Mascota</h2>
            <Campo etiqueta="Nombre" error={errMascota.nombre}>
              <input className={CLASE_INPUT} {...register("mascota.nombre")}/>
            </Campo>
            <Campo etiqueta="Especie" error={errMascota.especie}>
              <input className={CLASE_INPUT} placeholder="perro, gato..." {...register("mascota.especie")}/>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Raza (opcional)" error={errMascota.raza}>
                <input className={CLASE_INPUT} {...register("mascota.raza")}/>
              </Campo>
              <Campo etiqueta="Sexo (opcional)" error={errMascota.sexo}>
                <input className={CLASE_INPUT} {...register("mascota.sexo")}/>
              </Campo>
            </div>
            <Campo etiqueta="Nacimiento aproximado (opcional)" error={errMascota.fechaNacimientoAprox}>
              <input type="date" className={CLASE_INPUT} {...register("mascota.fechaNacimientoAprox")}/>
            </Campo>
          </section>

          {registrar.isError && <p role="alert" className="text-sm text-clay-dark">{registrar.error.message}</p>}
          <button type="submit" disabled={registrar.isPending} className="min-h-12 w-full rounded-md bg-pine font-medium text-white hover:bg-pine-dark disabled:opacity-50">
            {registrar.isPending ? "Registrando..." : "Registrar y abrir expediente"}
          </button>
        </form>
      </main>
    </div>);
}
