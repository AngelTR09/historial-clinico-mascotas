import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { esquemaCreacionDueno } from "@hcm/shared";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { PlantillaAutenticacion } from "../../components/ui/auth-layout";
import { CamposContrasena } from "../../components/auth/password-fields";
const esquemaFormulario = esquemaCreacionDueno
    .extend({ confirmarContrasena: z.string() })
    .refine((datos) => datos.contrasena === datos.confirmarContrasena, { message: "Las contraseñas no coinciden", path: ["confirmarContrasena"] });
export function PaginaRegistro() {
    const navigate = useNavigate();
    const { register, handleSubmit, formState: { errors }, } = useForm({
        resolver: zodResolver(esquemaFormulario),
        defaultValues: { tipoDocumento: "DNI" },
    });
    const mutation = useMutation({
        mutationFn: ({ confirmarContrasena: _confirmacion, ...input }) => api.post("/owners", input),
        // La cuenta nace inactiva: el siguiente paso es el código que llega al correo.
        onSuccess: (_datos, valores) => navigate("/verificar", { state: { rol: "dueno", correo: valores.correo.trim().toLowerCase(), contrasena: valores.contrasena } }),
    });
    return (<PlantillaAutenticacion icono={UserPlus} titulo="Registro de dueño" subtitulo="Crea tu cuenta para empezar a registrar el historial de salud de tus mascotas." pie={<div className="flex flex-col items-center gap-1">
          <Link to="/login" className="text-sm text-ink-soft hover:text-ink">¿Ya tienes cuenta? Inicia sesión</Link>
          <Link to="/vet" className="text-sm text-ink-soft hover:text-ink">Soy veterinario</Link>
        </div>}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Nombres</label>
            <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("nombres")}/>
            {errors.nombres && <p className="mt-1 text-xs text-clay-dark">{errors.nombres.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Apellidos</label>
            <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("apellidos")}/>
            {errors.apellidos && <p className="mt-1 text-xs text-clay-dark">{errors.apellidos.message}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">DNI</label>
          <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 font-mono focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("numeroDocumento")}/>
          {errors.numeroDocumento && <p className="mt-1 text-xs text-clay-dark">{errors.numeroDocumento.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Correo</label>
          <input type="email" className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("correo")}/>
          {errors.correo && <p className="mt-1 text-xs text-clay-dark">{errors.correo.message}</p>}
        </div>

        <CamposContrasena register={register} errors={errors}/>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Teléfono (opcional)</label>
          <input className="w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20" {...register("telefono")}/>
        </div>

        <label className="flex items-start gap-2 text-sm text-ink-soft">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-pine" {...register("aceptaTratamientoDatos")}/>
          Acepto el tratamiento de mis datos personales conforme a la Ley 29733.
        </label>
        {errors.aceptaTratamientoDatos && <p className="text-xs text-clay-dark">Debes aceptar el tratamiento de datos</p>}

        {mutation.isError && <p className="text-sm text-clay-dark">{mutation.error.message}</p>}

        <button type="submit" disabled={mutation.isPending} className="min-h-12 w-full rounded-md bg-pine font-medium text-white hover:bg-pine-dark disabled:opacity-50">
          {mutation.isPending ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </PlantillaAutenticacion>);
}
