/**
 * Dígito verificador de `pets.public_code`. Algoritmo módulo 11 con pesos
 * cíclicos 2-7 (el mismo usado en el dígito verificador del RUC peruano),
 * elegido por ser mental-calculable para QA manual y porque el resultado
 * cae siempre en un solo dígito 0-9 sin recurrir a una letra de control.
 */
export const LONGITUD_BASE_CODIGO_PUBLICO = 9;
export const LONGITUD_CODIGO_PUBLICO = LONGITUD_BASE_CODIGO_PUBLICO + 1;
const PESOS = [2, 3, 4, 5, 6, 7];
function afirmarBaseNumerica(base) {
    if (!/^\d+$/.test(base) || base.length !== LONGITUD_BASE_CODIGO_PUBLICO) {
        throw new Error(`La base del código público debe tener ${LONGITUD_BASE_CODIGO_PUBLICO} dígitos numéricos`);
    }
}
export function calcularDigitoVerificador(base) {
    afirmarBaseNumerica(base);
    let suma = 0;
    for (let i = 0; i < base.length; i++) {
        const digito = Number(base[base.length - 1 - i]);
        const peso = PESOS[i % PESOS.length];
        suma += digito * peso;
    }
    const resto = suma % 11;
    const verificador = (11 - resto) % 11;
    return String(verificador === 10 ? 0 : verificador);
}
export function formatearCodigoPublico(base) {
    return `${base}${calcularDigitoVerificador(base)}`;
}
export function esCodigoPublicoValido(codigo) {
    if (!/^\d+$/.test(codigo) || codigo.length !== LONGITUD_CODIGO_PUBLICO) {
        return false;
    }
    const base = codigo.slice(0, LONGITUD_BASE_CODIGO_PUBLICO);
    const verificador = codigo.slice(LONGITUD_BASE_CODIGO_PUBLICO);
    return calcularDigitoVerificador(base) === verificador;
}
