import { useEffect, useState } from "react";
export function useEstadoConexion() {
    const [enLinea, setEnLinea] = useState(() => navigator.onLine);
    useEffect(() => {
        function alConectar() {
            setEnLinea(true);
        }
        function alDesconectar() {
            setEnLinea(false);
        }
        window.addEventListener("online", alConectar);
        window.addEventListener("offline", alDesconectar);
        return () => {
            window.removeEventListener("online", alConectar);
            window.removeEventListener("offline", alDesconectar);
        };
    }, []);
    return enLinea;
}
