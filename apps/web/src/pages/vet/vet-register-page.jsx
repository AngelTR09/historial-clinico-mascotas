import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { esquemaCreacionVeterinario } from "@hcm/shared";
import { z } from "zod";
import { Stethoscope } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { PlantillaAutenticacion } from "../../components/ui/auth-layout";
import { CamposContrasena } from "../../components/auth/password-fields";
const esquemaFormulario = esquemaCreacionVeterinario.and(z.object({ confirmarContrasena: z.string() })).refine((datos) => datos.contrasena === datos.confirmarContrasena, { message: "Las contraseñas no coinciden", path: ["confirmarContrasena"] });
// Códigos ISO 3166-1 alfa-2; el nombre se resuelve con Intl para no mantener una tabla de traducciones.
const CODIGOS_PAIS = ["PE", "AR", "BO", "BR", "CL", "CO", "CR", "CU", "DO", "EC", "SV", "ES", "US", "GT", "HN", "MX", "NI", "PA", "PY", "PT", "UY", "VE", "CA", "FR", "DE", "IT", "GB"];
const nombresPais = new Intl.DisplayNames(["es"], { type: "region" });
const OPCIONES_PAIS = CODIGOS_PAIS.map((codigo) => ({ codigo, nombre: nombresPais.of(codigo) })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
const CLASE_INPUT = "w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";
export function PaginaRegistroVeterinario() {
    const navigate = useNavigate();
    const { register, handleSubmit, formState: { errors }, } = useForm({ resolver: zodResolver(esquemaFormulario), defaultValues: { pais: "PE" } });
    const mutation = useMutation({
        mutationFn: ({ confirmarContrasena: _confirmacion, ...input }) => api.post("/vets", input),
        // La cuenta nace inactiva y pendiente de aprobación: primero se verifica el correo.
        onSuccess: (_datos, valores) => navigate("/verificar", { state: { rol: "veterinario", correo: valores.correo.trim().toLowerCase() } }),
    });
    return (<PlantillaAutenticacion imagen="/img/veterinario-portada.webp" altImagen="Veterinaria sonriendo con una tableta en su consultorio" icono={Stethoscope} titulo="Cuenta de veterinario" subtitulo="Registra tu licencia profesional. Tu cuenta queda en revisión hasta que el equipo de Historial Clínico Mascotas la apruebe." pie={<div className="flex flex-col items-center gap-1">
          <Link to="/login" state={{ rol: "veterinario" }} className="text-sm text-ink-soft hover:text-ink">¿Ya tienes cuenta? Inicia sesión</Link>
          <Link to="/" className="text-sm text-ink-soft hover:text-ink">Soy dueño de una mascota</Link>
        </div>}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">País de tu licencia</label>
          <select className={CLASE_INPUT} {...register("pais")}>
            {OPCIONES_PAIS.map(({ codigo, nombre }) => (<option key={codigo} value={codigo}>
                {nombre}
              </option>))}
          </select>
          {errors.pais && <p className="mt-1 text-xs text-clay-dark">{errors.pais.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Entidad que emitió tu licencia</label>
          <input className={CLASE_INPUT} placeholder="Ej.: CMVP, Colegio Oficial de Veterinarios de Madrid" {...register("autoridadEmisora")}/>
          {errors.autoridadEmisora && <p className="mt-1 text-xs text-clay-dark">{errors.autoridadEmisora.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Número de licencia o colegiatura</label>
          <input className={`${CLASE_INPUT} font-mono`} {...register("numeroLicencia")}/>
          {errors.numeroLicencia && <p className="mt-1 text-xs text-clay-dark">{errors.numeroLicencia.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Identificador fiscal del establecimiento <span className="font-normal text-ink-soft">(opcional)</span>
          </label>
          <input className={`${CLASE_INPUT} font-mono`} placeholder="RUC, EIN, NIF..." {...register("identificadorFiscal")}/>
          {errors.identificadorFiscal && <p className="mt-1 text-xs text-clay-dark">{errors.identificadorFiscal.message}</p>}
        </div>

        <div>
          <label htmlFor="correo" className="mb-1 block text-sm font-medium text-ink">Correo</label>
          <input id="correo" type="email" autoComplete="username" className={CLASE_INPUT} {...register("correo")}/>
          {errors.correo && <p className="mt-1 text-xs text-clay-dark">{errors.correo.message}</p>}
        </div>

        <CamposContrasena register={register} errors={errors}/>

        {mutation.isError && <p className="text-sm text-clay-dark">{mutation.error.message}</p>}

        <button type="submit" disabled={mutation.isPending} className="min-h-12 w-full rounded-md bg-pine font-medium text-white hover:bg-pine-dark disabled:opacity-50">
          {mutation.isPending ? "Enviando..." : "Solicitar cuenta profesional"}
        </button>
      </form>
    </PlantillaAutenticacion>);
}
