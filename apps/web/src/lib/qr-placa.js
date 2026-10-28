import QRCode from "qrcode";

/** Zona de silencio exigida por la norma del QR: 4 módulos libres por cada lado. */
const MODULOS_SILENCIO = 4;

/**
 * Arma el SVG de la placa para grabado láser: vectorial, un solo trazo negro
 * sobre fondo blanco (sin degradados ni esquinas redondeadas), con zona de
 * silencio y tamaño físico en milímetros para que el programa del láser lo
 * importe a escala real. Corrección de errores nivel Q (25 %) por si la
 * grabadora pierde detalle en el borde de los módulos.
 *
 * @param {string} texto Contenido del QR (la URL de la ficha pública).
 * @param {{ milimetros?: number }} [opciones] Lado total de la placa, zona de silencio incluida.
 */
export function generarSvgPlacaQr(texto, { milimetros = 30 } = {}) {
    const { modules } = QRCode.create(texto, { errorCorrectionLevel: "Q" });
    const lado = modules.size + MODULOS_SILENCIO * 2;
    let trazo = "";
    for (let fila = 0; fila < modules.size; fila++) {
        for (let columna = 0; columna < modules.size; columna++) {
            if (modules.get(fila, columna)) {
                trazo += `M${columna + MODULOS_SILENCIO} ${fila + MODULOS_SILENCIO}h1v1h-1z`;
            }
        }
    }
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${milimetros}mm" height="${milimetros}mm" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges">`,
        `<rect width="${lado}" height="${lado}" fill="#fff"/>`,
        `<path d="${trazo}" fill="#000"/>`,
        `</svg>`,
    ].join("");
}

/** Descarga el SVG de la placa con un nombre legible para el archivo del láser. */
export function descargarSvgPlacaQr(texto, nombreArchivo) {
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([generarSvgPlacaQr(texto)], { type: "image/svg+xml" }));
    enlace.download = `${nombreArchivo}.svg`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
}
