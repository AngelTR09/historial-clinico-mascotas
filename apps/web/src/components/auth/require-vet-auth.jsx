import { Navigate } from "react-router-dom";
import { obtenerTokenVeterinario } from "../../lib/auth-storage";
export function RequiereAutenticacionVeterinario({ children }) {
    if (!obtenerTokenVeterinario()) {
        return <Navigate to="/login" replace state={{ rol: "veterinario" }}/>;
    }
    return <>{children}</>;
}
