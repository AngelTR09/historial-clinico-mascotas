import { CampoContrasenaVisible } from "./password-input";
/**
 * Contraseña y su confirmación para las pantallas de alta. La política es la del esquema
 * compartido (la misma que usará Cognito): 12 caracteres con minúscula, mayúscula, número y símbolo.
 */
export function CamposContrasena({ register, errors }) {
    return (<>
      <div>
        <label htmlFor="contrasena" className="mb-1 block text-sm font-medium text-ink">Contraseña</label>
        <CampoContrasenaVisible id="contrasena" autoComplete="new-password" {...register("contrasena")}/>
        <p className="mt-1 text-xs text-ink-faint">Al menos 12 caracteres, con minúscula, mayúscula, número y símbolo.</p>
        {errors.contrasena && <p className="mt-1 text-xs text-clay-dark">{errors.contrasena.message}</p>}
      </div>
      <div>
        <label htmlFor="confirmarContrasena" className="mb-1 block text-sm font-medium text-ink">Repite la contraseña</label>
        <CampoContrasenaVisible id="confirmarContrasena" autoComplete="new-password" {...register("confirmarContrasena")}/>
        {errors.confirmarContrasena && <p className="mt-1 text-xs text-clay-dark">{errors.confirmarContrasena.message}</p>}
      </div>
    </>);
}
