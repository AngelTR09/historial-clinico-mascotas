import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { esquemaInicioSesion } from "@hcm/shared";
import { LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ErrorApi } from "../../api/client";
import { PlantillaAutenticacion } from "../../components/ui/auth-layout";
import { CampoContrasenaVisible } from "../../components/auth/password-input";
import { establecerToken, establecerTokenVeterinario } from "../../lib/auth-storage";
import { claseBoton } from "../../components/ui/boton";
const CLASE_INPUT = "w-full min-h-11 rounded-md border border-control-border px-3 bg-surface text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus";
/**
 * Inicio de sesión con correo y contraseña (RNF 03 y 06). Si la cuenta aún no verificó su correo, el
 * servidor responde 403 y se ofrece pasar a la pantalla del código. En AWS lo reemplaza Cognito.
 */
export function PaginaInicioSesion() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const { register, handleSubmit, getValues, formState: { errors }, } = useForm({
        resolver: zodResolver(esquemaInicioSesion),
        defaultValues: { correo: state?.correo ?? "", contrasena: "" },
    });
    const iniciar = useMutation({
        mutationFn: (valores) => api.post("/auth/login", valores, { token: null }),
        // El servidor decide si la cuenta es de dueño o de veterinario y lo devuelve en `rol`.
        onSuccess: ({ token, rol }) => {
            if (rol === "veterinario") {
                establecerTokenVeterinario(token);
                navigate("/vet/dashboard");
            }
            else {
                establecerToken(token);
                navigate("/dashboard");
            }
        },
    });
    const sinVerificar = iniciar.error instanceof ErrorApi && iniciar.error.status === 403 && /verificar/i.test(iniciar.error.message);
    const rolSinVerificar = sinVerificar ? iniciar.error.datos?.rol ?? "dueno" : null;
    return (<PlantillaAutenticacion icono={LogIn} titulo="Iniciar sesión" subtitulo="Entra con el correo y la contraseña de tu cuenta." pie={<div className="flex flex-col items-center gap-1">
          <Link to="/register" className="text-sm text-ink-soft hover:text-ink">¿No tienes cuenta? Regístrate</Link>
          <Link to="/vet" className="text-sm text-ink-soft hover:text-ink">Soy veterinario: crear cuenta profesional</Link>
        </div>}>
      <form className="space-y-4" noValidate onSubmit={handleSubmit((valores) => iniciar.mutate(valores))}>
        <div>
          <label htmlFor="correo" className="mb-2 block text-sm font-medium text-ink">Correo</label>
          <input id="correo" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} className={CLASE_INPUT} {...register("correo")}/>
          {errors.correo && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.correo.message}</p>}
        </div>
        <div>
          <label htmlFor="contrasena" className="mb-2 block text-sm font-medium text-ink">Contraseña</label>
          <CampoContrasenaVisible id="contrasena" autoComplete="current-password" maxLength={128} {...register("contrasena")}/>
          {errors.contrasena && <p className="mt-2 text-sm font-medium text-clay-ink">{errors.contrasena.message}</p>}
        </div>

        {iniciar.isError && <p role="alert" className="text-sm text-clay-ink">{iniciar.error.message}</p>}
        {sinVerificar && (<button type="button" onClick={() => navigate("/verificar", { state: { rol: rolSinVerificar, correo: getValues("correo") } })} className="min-h-11 text-sm text-pine underline">
            Ingresar el código de verificación
          </button>)}

        <button type="submit" disabled={iniciar.isPending} className={claseBoton({ tamano: "lg", bloque: true })}>
          {iniciar.isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </PlantillaAutenticacion>);
}
