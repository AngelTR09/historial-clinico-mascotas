import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef } from "react";
const ID_REGION = "qr-scanner-region";
/**
 * Cámara real (getUserMedia) para escanear el QR de la placa. Requiere
 * un contexto seguro (https o localhost) y permiso del usuario; si
 * falla, `alError` avisa para que quien lo use ofrezca el campo de texto
 * manual como respaldo — la cámara nunca es el único camino.
 */
export function EscanerQr({ alEscanear, alError }) {
    const alEscanearRef = useRef(alEscanear);
    const alErrorRef = useRef(alError);
    // Se actualizan en un efecto (no durante el render) para que el efecto
    // de la cámara, que no depende de ellos, siempre llame al callback vigente.
    useEffect(() => {
        alEscanearRef.current = alEscanear;
        alErrorRef.current = alError;
    });
    useEffect(() => {
        let cancelado = false;
        let resultadoManejado = false;
        const escaner = new Html5Qrcode(ID_REGION);
        escaner
            .start({ facingMode: "environment" }, { fps: 10, qrbox: 220 }, (textoDecodificado) => {
            if (resultadoManejado || cancelado)
                {return;}
            resultadoManejado = true;
            escaner
                .stop()
                .catch(() => { })
                .finally(() => escaner.clear());
            alEscanearRef.current(textoDecodificado);
        }, () => {
            // fallo de decodificación de un frame individual: se ignora, sigue intentando
        })
            .catch((error) => {
            if (cancelado)
                {return;}
            alErrorRef.current?.(error instanceof Error ? error.message : "No se pudo acceder a la cámara");
        });
        return () => {
            cancelado = true;
            if (escaner.isScanning) {
                escaner
                    .stop()
                    .catch(() => { })
                    .finally(() => escaner.clear());
            }
            else {
                escaner.clear();
            }
        };
    }, []);
    return <div id={ID_REGION} className="mx-auto w-full max-w-xs overflow-hidden rounded-lg [&_video]:rounded-lg"/>;
}
