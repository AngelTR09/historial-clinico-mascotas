const CLAVE_TOKEN = "hcm.token";
const CLAVE_TOKEN_VETERINARIO = "hcm.vetToken";
export function obtenerToken() {
    return localStorage.getItem(CLAVE_TOKEN);
}
export function establecerToken(token) {
    localStorage.setItem(CLAVE_TOKEN, token);
}
export function limpiarToken() {
    localStorage.removeItem(CLAVE_TOKEN);
}
/**
 * Token de cuenta profesional del veterinario. Se guarda aparte del
 * token de dueño porque son roles distintos que pueden convivir en el
 * mismo navegador (RF 13). El acceso acotado por mascota (RN 10) no vive
 * aquí a propósito: nace de escanear un QR y no debe sobrevivir más que
 * la sesión de esa validación.
 */
export function obtenerTokenVeterinario() {
    return localStorage.getItem(CLAVE_TOKEN_VETERINARIO);
}
export function establecerTokenVeterinario(token) {
    localStorage.setItem(CLAVE_TOKEN_VETERINARIO, token);
}
export function limpiarTokenVeterinario() {
    localStorage.removeItem(CLAVE_TOKEN_VETERINARIO);
}
