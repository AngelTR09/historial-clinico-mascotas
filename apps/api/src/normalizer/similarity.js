const DIACRITICOS_COMBINABLES = new RegExp("[\\u0300-\\u036f]", "g");
const PALABRAS_VACIAS = new Set(["vacuna", "vacunacion", "vacunación", "contra", "de", "del", "la", "el", "los", "las", "para"]);
/** Minúsculas, sin tildes, sin puntuación — para comparar texto libre contra el catálogo. */
export function normalizarTexto(text) {
    return text
        .normalize("NFD")
        .replace(DIACRITICOS_COMBINABLES, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function quitarPalabrasVacias(normalizado) {
    const conservadas = normalizado.split(" ").filter((token) => token.length > 0 && !PALABRAS_VACIAS.has(token));
    return conservadas.join(" ");
}
function distanciaLevenshtein(a, b) {
    const filas = a.length + 1;
    const columnas = b.length + 1;
    const dp = Array.from({ length: filas }, () => new Array(columnas).fill(0));
    for (let i = 0; i < filas; i++)
        {dp[i][0] = i;}
    for (let j = 0; j < columnas; j++)
        {dp[0][j] = j;}
    for (let i = 1; i < filas; i++) {
        for (let j = 1; j < columnas; j++) {
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[filas - 1][columnas - 1];
}
/**
 * 1.0 si un texto contiene literalmente al otro (típico cuando el dueño
 * escribe "vacuna antirrábica" y el catálogo dice "Antirrábica"); si no,
 * similitud de Levenshtein normalizada por longitud (0 a 1).
 */
export function similitudTexto(a, b) {
    const izquierda = quitarPalabrasVacias(normalizarTexto(a));
    const derecha = quitarPalabrasVacias(normalizarTexto(b));
    if (!izquierda || !derecha)
        {return 0;}
    if (izquierda === derecha || izquierda.includes(derecha) || derecha.includes(izquierda))
        {return 1;}
    const distancia = distanciaLevenshtein(izquierda, derecha);
    const longitudMaxima = Math.max(izquierda.length, derecha.length);
    return longitudMaxima === 0 ? 1 : 1 - distancia / longitudMaxima;
}
/** Similitud a partir de la cual se acepta el match sin intervención humana. */
export const UMBRAL_AUTO_MATCH_VACUNA = 0.7;
/** Similitud mínima para dejar una sugerencia en la cola de curaduría; por debajo, sin sugerencia. */
export const UMBRAL_SUGERENCIA_VACUNA = 0.4;
/** Mejor candidato del catálogo (ya acotado a la especie) para un texto libre, o null si no hay ninguno. */
export function mejorCoincidenciaVacuna(textoOriginal, candidates) {
    let mejor = null;
    for (const candidate of candidates) {
        const score = similitudTexto(textoOriginal, candidate.nombreCanonico);
        if (!mejor || score > mejor.score) {
            mejor = { candidate, score };
        }
    }
    return mejor;
}
