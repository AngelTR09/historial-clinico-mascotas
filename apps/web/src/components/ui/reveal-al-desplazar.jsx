import { useEffect, useRef, useState } from "react";

/*
 * Revela su contenido con una transición suave cuando entra en pantalla.
 * Usa IntersectionObserver y anima en ambos sentidos: al bajar el bloque sube
 * desde abajo; al subir baja desde arriba. Al salir de pantalla se oculta de
 * nuevo para poder animarse otra vez. Degrada con gracia:
 * si el navegador no lo soporta, muestra el contenido de inmediato. El
 * estilo del estado inicial/final vive en index.css (.revelar / .revelar-visible),
 * que además se anula con prefers-reduced-motion.
 */
export function Revelar({ children, className = "", comoEtiqueta: Etiqueta = "div", retardoMs = 0 }) {
  const referencia = useRef(null);
  // Si el navegador no soporta IntersectionObserver, nace visible: nada que observar.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  // Por dónde quedó el bloque al salir: define desde dónde vuelve a entrar.
  const [saleArriba, setSaleArriba] = useState(false);
  const sinObservador = typeof IntersectionObserver === "undefined";

  useEffect(() => {
    if (sinObservador) return;
    const nodo = referencia.current;
    if (!nodo) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            setVisible(true);
          } else {
            setSaleArriba(entrada.boundingClientRect.top < 0);
            setVisible(false);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [sinObservador]);

  return (
    <Etiqueta
      ref={referencia}
      style={retardoMs ? { transitionDelay: `${retardoMs}ms` } : undefined}
      className={`revelar ${visible ? "revelar-visible" : saleArriba ? "revelar-arriba" : ""} ${className}`.trim()}
    >
      {children}
    </Etiqueta>
  );
}
