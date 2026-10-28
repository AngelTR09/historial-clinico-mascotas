import { Navigate } from "react-router-dom";
import { obtenerToken } from "../../lib/auth-storage";
export function RequiereAutenticacion({ children }) {
    if (!obtenerToken()) {
        return <Navigate to="/login" replace/>;
    }
    return <>{children}</>;
}
