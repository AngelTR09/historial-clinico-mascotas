import { useMutation } from "@tanstack/react-query";
import { esquemaBaseCreacionDueno, TIPOS_DOCUMENTO, validarDocumento } from "@hcm/shared";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { PlantillaAutenticacion } from "../../components/ui/auth-layout";
import { CamposContrasena } from "../../components/auth/password-fields";
import { claseBoton } from "../../components/ui/boton";
import { AYUDA_DOCUMENTO, entrada, entradaDocumento, ETIQUETA_DOCUMENTO } from "../../lib/entrada";
import { Entrada } from "../../components/ui/campo";
import { resolverConDocumento } from "../../lib/resolver-documento";
const esquemaFormulario = esquemaBaseCreacionDueno
    .extend({ confirmarContrasena: z.string() })
    .superRefine((datos, ctx) => validarDocumento(datos, ctx))
    .refine((datos) => datos.contrasena === datos.confirmarContrasena, { message: "Las contraseñas no coinciden", path: ["confirmarContrasena"] });
export function PaginaRegistro() {
    const navigate = useNavigate();
    const { register, handleSubmit, control, formState: { errors }, } = useForm({
        resolver: resolverConDocumento(esquemaFormulario),
        defaultValues: { tipoDocumento: "DNI" },
    });
    const tipoDocumento = useWatch({ control, name: "tipoDocumento" }) ?? "DNI";
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
            <label htmlFor="nombres" className="mb-2 block text-sm font-medium text-ink">Nombres</label>
            <Entrada id="nombres" className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("nombres")} {...entrada("nombrePersona")}/>
            {errors.nombres && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.nombres.message}</p>}
          </div>
          <div>
            <label htmlFor="apellidos" className="mb-2 block text-sm font-medium text-ink">Apellidos</label>
            <Entrada id="apellidos" className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("apellidos")} {...entrada("apellidos")}/>
            {errors.apellidos && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.apellidos.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[11rem_1fr]">
          <div>
            <label htmlFor="tipoDocumento" className="mb-2 block text-sm font-medium text-ink">Documento</label>
            <select id="tipoDocumento" className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("tipoDocumento")}>
              {TIPOS_DOCUMENTO.map((tipo) => (<option key={tipo} value={tipo}>{ETIQUETA_DOCUMENTO[tipo]}</option>))}
            </select>
          </div>
          <div>
            <label htmlFor="numeroDocumento" className="mb-2 block text-sm font-medium text-ink">Número de {ETIQUETA_DOCUMENTO[tipoDocumento]}</label>
            <Entrada id="numeroDocumento" className="w-full min-h-11 rounded-md border border-control-border px-3 font-mono bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("numeroDocumento")} {...entradaDocumento(tipoDocumento)}/>
            <p className="mt-2 text-sm text-ink-soft">{AYUDA_DOCUMENTO[tipoDocumento]}</p>
            {errors.numeroDocumento && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.numeroDocumento.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="correo" className="mb-2 block text-sm font-medium text-ink">Correo</label>
          <Entrada id="correo" type="email" autoComplete="username" className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("correo")} {...entrada("correo")}/>
          {errors.correo && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.correo.message}</p>}
        </div>

        <CamposContrasena register={register} errors={errors}/>

        <div>
          <label htmlFor="telefono" className="mb-2 block text-sm font-medium text-ink">Teléfono (opcional)</label>
          <Entrada id="telefono" className="w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus" {...register("telefono")} {...entrada("telefono")} placeholder="944 556 677"/>
        </div>

        <label className="flex items-start gap-2 text-sm text-ink-soft">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-pine" {...register("aceptaTratamientoDatos")}/>
          Acepto el tratamiento de mis datos personales conforme a la Ley 29733.
        </label>
        {errors.aceptaTratamientoDatos && <p className="text-xs text-clay-ink">Debes aceptar el tratamiento de datos</p>}

        {mutation.isError && <p className="text-sm text-clay-ink">{mutation.error.message}</p>}

        <button type="submit" disabled={mutation.isPending} className={claseBoton({ tamano: "lg", bloque: true })}>
          {mutation.isPending ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </PlantillaAutenticacion>);
}
