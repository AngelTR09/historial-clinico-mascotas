import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { PlantillaAutenticacion } from "../../components/ui/auth-layout";
import { establecerToken, establecerTokenVeterinario } from "../../lib/auth-storage";
/**
 * Segundo paso del registro (RNF 03): la cuenta nace inactiva y se activa con el código de 6 dígitos
 * que llegó al correo. Un código vale 15 minutos, admite 5 intentos y es de un solo uso.
 */
export function PaginaVerificacionCorreo() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [codigo, setCodigo] = useState("");
    const verificar = useMutation({
        mutationFn: () => api.post("/auth/verify", { rol: state.rol, correo: state.correo, codigo }, { token: null }),
        onSuccess: ({ token }) => {
            if (state.rol === "veterinario") {
                establecerTokenVeterinario(token);
                navigate("/vet/dashboard");
            }
            else {
                establecerToken(token);
                navigate("/dashboard");
            }
        },
    });
    const reenviar = useMutation({ mutationFn: () => api.post("/auth/resend-code", { rol: state.rol, correo: state.correo }, { token: null }) });
    if (!state?.rol || !state?.correo) {
        return <Navigate to="/login" replace/>;
    }
    return (<PlantillaAutenticacion icono={MailCheck} titulo="Verifica tu correo" subtitulo={`Te enviamos un código de 6 dígitos a ${state.correo}. Vale 15 minutos.`} pie={<Link to="/login" state={{ rol: state.rol, correo: state.correo }} className="text-sm text-ink-soft hover:text-ink">
          Volver a iniciar sesión
        </Link>}>
      <form className="space-y-4" onSubmit={(evento) => {
            evento.preventDefault();
            verificar.mutate();
        }}>
        <div>
          <label htmlFor="codigo" className="mb-1 block text-sm font-medium text-ink">Código</label>
          <input id="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(evento) => setCodigo(evento.target.value.replace(/\D/g, ""))} className="w-full min-h-12 rounded-md border border-sand-dark px-3 text-center font-mono text-xl tracking-[0.4em] focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"/>
        </div>

        {verificar.isError && <p role="alert" className="text-sm text-clay-dark">{verificar.error.message}</p>}

        <button type="submit" disabled={codigo.length !== 6 || verificar.isPending} className="min-h-12 w-full rounded-md bg-pine font-medium text-white hover:bg-pine-dark disabled:opacity-50">
          {verificar.isPending ? "Verificando..." : "Verificar"}
        </button>

        <button type="button" onClick={() => reenviar.mutate()} disabled={reenviar.isPending} className="min-h-11 w-full text-sm text-pine underline disabled:opacity-50">
          Reenviar el código
        </button>
        {reenviar.isSuccess && <p role="status" className="text-sm text-ink-soft">Si tu cuenta sigue sin verificar, te enviamos otro código.</p>}
      </form>
    </PlantillaAutenticacion>);
}
