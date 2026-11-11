import { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";

/** Clases del control de texto (input, select, textarea). Borde de control a 3:1. */
export const CLASE_CAMPO = "w-full min-h-11 rounded-md border border-control-border bg-surface px-3 text-ink hover:border-ink-soft focus:border-pine focus:outline-none focus:shadow-focus aria-[invalid=true]:border-clay disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-soft";

/**
 * Input o textarea con contador de caracteres dentro del campo (`12/60`) cuando tiene `maxLength`.
 * El contador pasa a rojo en el límite. Sin `maxLength` (fechas, selects) o en contraseñas, se
 * comporta como el elemento normal. Sirve con campos no controlados de react-hook-form: lee el largo
 * al escribir y tras cada render, para que `reset` o un valor inicial también cuenten.
 */
export const Entrada = forwardRef(function Entrada({ comoEtiqueta: Etiqueta = "input", className = "", maxLength, onInput, type, sinContador = false, ...resto }, ref) {
    const interno = useRef(null);
    const [largo, setLargo] = useState(0);
    const fijarRef = useCallback((elemento) => {
        interno.current = elemento;
        if (typeof ref === "function") {
            ref(elemento);
        }
        else if (ref) {
            ref.current = elemento;
        }
    }, [ref]);
    // Sin dependencias a propósito: react-hook-form cambia `value` sin disparar eventos (reset, valores iniciales).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const actual = interno.current?.value?.length ?? 0;
        if (actual !== largo) {
            setLargo(actual);
        }
    });
    const conContador = Boolean(maxLength) && !sinContador && type !== "password";
    if (!conContador) {
        return <Etiqueta ref={fijarRef} type={type} maxLength={maxLength} onInput={onInput} className={className} {...resto}/>;
    }
    const esAreaDeTexto = Etiqueta === "textarea";
    const alLimite = largo >= maxLength;
    return (<div className={`relative min-w-0 ${/\bflex-1\b/.test(className) ? "flex-1" : ""}`.trim()}>
      <Etiqueta ref={fijarRef} type={type} maxLength={maxLength} className={`${className} pr-16`.trim()} onInput={(evento) => {
            onInput?.(evento);
            setLargo(evento.target.value.length);
        }} {...resto}/>
      <span aria-hidden="true" className={`pointer-events-none absolute right-3 text-xs tabular-nums ${esAreaDeTexto ? "bottom-2" : "top-1/2 -translate-y-1/2"} ${alLimite ? "text-clay-ink" : "text-ink-faint"}`}>
        {largo}/{maxLength}
      </span>
    </div>);
});

/**
 * Campo con etiqueta, ayuda y error cableados con aria-describedby. Recibe el
 * `register` de react-hook-form directamente (`<Campo etiqueta="Correo" error={errors.correo?.message} {...register("correo")}/>`).
 * variante: "mono" para códigos y documentos; "codigo" para el código de 6 dígitos.
 */
export const Campo = forwardRef(function Campo({ etiqueta, opcional = false, ayuda, error, variante, comoEtiqueta: Etiqueta = "input", className = "", id: idExterno, ...resto }, ref) {
    const idAuto = useId();
    const id = idExterno ?? idAuto;
    const idAyuda = ayuda ? `${id}-ayuda` : undefined;
    const idError = error ? `${id}-error` : undefined;
    const extra = variante === "mono" ? "font-mono" : variante === "codigo" ? "min-h-12 text-center font-mono text-xl tracking-[0.4em]" : "";
    return (<div className="min-w-0">
      {etiqueta && (<label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
          {etiqueta}
          {opcional && <span className="ml-1 font-normal text-ink-soft">(opcional)</span>}
        </label>)}
      <Entrada comoEtiqueta={Etiqueta} ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={[idAyuda, idError].filter(Boolean).join(" ") || undefined} className={`${CLASE_CAMPO} ${extra} ${className}`.trim()} sinContador={variante === "codigo"} {...resto}/>
      {ayuda && <p id={idAyuda} className="mt-2 text-sm text-ink-soft">{ayuda}</p>}
      {error && <p id={idError} className="mt-2 text-sm font-medium text-clay-ink">{error}</p>}
    </div>);
});
