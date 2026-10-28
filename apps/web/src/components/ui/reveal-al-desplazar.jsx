import { useEffect, useRef, useState } from "react";

/*
 * Revela su contenido con una transición suave cuando entra en pantalla.
 * Usa IntersectionObserver (una sola vez por bloque) y degrada con gracia:
 * si el navegador no lo soporta, muestra el contenido de inmediato. El
 * estilo del estado inicial/final vive en index.css (.revelar / .revelar-visible),
 * que además se anula con prefers-reduced-motion.
 */
export function Revelar({ children, className = "", comoEtiqueta: Etiqueta = "div", retardoMs = 0 }) {
  const referencia = useRef(null);
  // Si el navegador no soporta IntersectionObserver, nace visible: nada que observar.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (visible) return;
    const nodo = referencia.current;
    if (!nodo) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            setVisible(true);
            observador.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [visible]);

  return (
    <Etiqueta
      ref={referencia}
      style={retardoMs ? { transitionDelay: `${retardoMs}ms` } : undefined}
      className={`revelar ${visible ? "revelar-visible" : ""} ${className}`.trim()}
    >
      {children}
    </Etiqueta>
  );
}
