/** Primera letra en mayúscula y el resto intacto: "5 años y 7 meses" no debe volverse "5 Años Y 7 Meses". */
export function capitalizar(texto) {
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

/** Une partes con " · " descartando las vacías y capitalizando cada una ("Perro · Mestizo · 5 años y 7 meses"). */
export function unirDatos(partes) {
    return partes.filter(Boolean).map(capitalizar).join(" · ");
}
