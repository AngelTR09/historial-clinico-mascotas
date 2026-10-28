import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { esquemaInicioSesion } from "@hcm/shared";
import { LogIn } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ErrorApi } from "../../api/client";
import { PlantillaAutenticacion } from "../../components/ui/auth-layout";
import { CampoContrasenaVisible } from "../../components/auth/password-input";
import { establecerToken, establecerTokenVeterinario } from "../../lib/auth-storage";
const CLASE_INPUT = "w-full min-h-11 rounded-md border border-sand-dark px-3 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";
const ROLES = [
    { valor: "dueno", etiqueta: "Soy dueño" },
    { valor: "veterinario", etiqueta: "Soy veterinario" },
];
/**
 * Inicio de sesión con correo y contraseña (RNF 03 y 06). Si la cuenta aún no verificó su correo, el
 * servidor responde 403 y se ofrece pasar a la pantalla del código. En AWS lo reemplaza Cognito.
 */
export function PaginaInicioSesion() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const { register, handleSubmit, control, getValues, formState: { errors }, } = useForm({
        resolver: zodResolver(esquemaInicioSesion),
        defaultValues: { rol: state?.rol ?? "dueno", correo: state?.correo ?? "", contrasena: "" },
    });
    const rol = useWatch({ control, name: "rol" });
    const iniciar = useMutation({
        mutationFn: (valores) => api.post("/auth/login", valores, { token: null }),
        onSuccess: ({ token }, valores) => {
            if (valores.rol === "veterinario") {
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
    return (<PlantillaAutenticacion icono={LogIn} titulo="Iniciar sesión" subtitulo="Entra con el correo y la contraseña de tu cuenta." pie={<Link to={rol === "veterinario" ? "/vet" : "/register"} className="text-sm text-ink-soft hover:text-ink">
          ¿No tienes cuenta? Regístrate
        </Link>}>
      <form className="space-y-4" onSubmit={handleSubmit((valores) => iniciar.mutate(valores))}>
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-ink">Tipo de cuenta</legend>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(({ valor, etiqueta }) => (<label key={valor} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm ${rol === valor ? "border-pine bg-pine-tint text-pine-dark" : "border-sand-dark text-ink-soft"}`}>
                <input type="radio" value={valor} className="sr-only" {...register("rol")}/>
                {etiqueta}
              </label>))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="correo" className="mb-1 block text-sm font-medium text-ink">Correo</label>
          <input id="correo" type="email" autoComplete="username" className={CLASE_INPUT} {...register("correo")}/>
          {errors.correo && <p className="mt-1 text-xs text-clay-dark">{errors.correo.message}</p>}
        </div>
        <div>
          <label htmlFor="contrasena" className="mb-1 block text-sm font-medium text-ink">Contraseña</label>
          <CampoContrasenaVisible id="contrasena" autoComplete="current-password" {...register("contrasena")}/>
          {errors.contrasena && <p className="mt-1 text-xs text-clay-dark">Escribe tu contraseña</p>}
        </div>

        {iniciar.isError && <p role="alert" className="text-sm text-clay-dark">{iniciar.error.message}</p>}
        {sinVerificar && (<button type="button" onClick={() => navigate("/verificar", { state: { rol, correo: getValues("correo") } })} className="min-h-11 text-sm text-pine underline">
            Ingresar el código de verificación
          </button>)}

        <button type="submit" disabled={iniciar.isPending} className="min-h-12 w-full rounded-md bg-pine font-medium text-white hover:bg-pine-dark disabled:opacity-50">
          {iniciar.isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </PlantillaAutenticacion>);
}
