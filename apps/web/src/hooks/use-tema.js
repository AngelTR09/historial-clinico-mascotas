import { useCallback, useEffect, useState } from "react";
const CLAVE = "hcm-tema";
function temaInicial() {
    const aplicado = document.documentElement.getAttribute("data-theme");
    if (aplicado === "light" || aplicado === "dark") {
        return aplicado;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
/** Tema claro/oscuro: respeta prefers-color-scheme y recuerda la elección del usuario. */
export function useTema() {
    const [tema, setTema] = useState(temaInicial);
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", tema);
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema === "dark" ? "#0F1512" : "#F4F6F2");
    }, [tema]);
    const alternar = useCallback(() => {
        setTema((actual) => {
            const siguiente = actual === "dark" ? "light" : "dark";
            try {
                localStorage.setItem(CLAVE, siguiente);
            }
            catch {
                // Almacenamiento bloqueado: el tema vale solo para esta sesión.
            }
            return siguiente;
        });
    }, []);
    return { tema, alternar };
}
