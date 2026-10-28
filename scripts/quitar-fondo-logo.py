#!/usr/bin/env python3
"""Quita el fondo blanco de un logo de tinta plana y lo guarda como PNG transparente.

    python3 scripts/quitar-fondo-logo.py <entrada.png> <salida.png> [margen_px]

No usa un umbral duro (que deja un halo blanco en los bordes suavizados): estima la
opacidad de cada píxel según qué tan lejos está del blanco y recupera el color original
de la tinta. Recorta los márgenes vacíos y deja `margen_px` (por defecto 16) alrededor.
"""
import sys
from PIL import Image

TINTA_MAS_OSCURA = 36  # canal mínimo de la tinta más oscura del logo (verde pino #215d48)


def quitar_fondo(entrada, salida, margen=16):
    origen = Image.open(entrada).convert("RGB")
    ancho, alto = origen.size
    pixeles = origen.load()
    resultado = Image.new("RGBA", origen.size)
    destino = resultado.load()
    for y in range(alto):
        for x in range(ancho):
            r, g, b = pixeles[x, y]
            alfa = min(1.0, (255 - min(r, g, b)) / (255 - TINTA_MAS_OSCURA))
            if alfa < 0.02:
                destino[x, y] = (0, 0, 0, 0)
                continue
            # Deshace la mezcla con el blanco: color = (pixel - 255 * (1 - alfa)) / alfa
            destino[x, y] = tuple(max(0, min(255, round((c - 255 * (1 - alfa)) / alfa))) for c in (r, g, b)) + (round(alfa * 255),)
    caja = resultado.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if caja:
        izq, sup, der, inf = caja
        resultado = resultado.crop((max(0, izq - margen), max(0, sup - margen), min(ancho, der + margen), min(alto, inf + margen)))
    resultado.save(salida, optimize=True)
    return resultado.size


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    margen = int(sys.argv[3]) if len(sys.argv) > 3 else 16
    print("OK", salida := sys.argv[2], quitar_fondo(sys.argv[1], salida, margen))
