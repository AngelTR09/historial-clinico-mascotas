import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derivar = promisify(scrypt);
// Costo de scrypt: 16 MiB y ~50 ms por hash. Subirlo exige subir también la memoria del contenedor.
const N = 16384;
const R = 8;
const P = 1;
const LARGO_CLAVE = 64;
/** Hash con sal propia, en el formato `scrypt$N$r$p$sal$hash` (los parámetros viajan con el hash). */
export async function hashContrasena(contrasena) {
    const sal = randomBytes(16);
    const hash = await derivar(contrasena.normalize("NFKC"), sal, LARGO_CLAVE, { N, r: R, p: P });
    return `scrypt$${N}$${R}$${P}$${sal.toString("base64")}$${hash.toString("base64")}`;
}
/** Comparación en tiempo constante. Un hash mal formado nunca coincide, no lanza. */
export async function verificarContrasena(contrasena, almacenado) {
    const [algoritmo, n, r, p, sal, hash] = almacenado.split("$");
    if (algoritmo !== "scrypt" || !hash) {
        return false;
    }
    const esperado = Buffer.from(hash, "base64");
    const obtenido = await derivar(contrasena.normalize("NFKC"), Buffer.from(sal, "base64"), esperado.length, { N: Number(n), r: Number(r), p: Number(p) });
    return timingSafeEqual(obtenido, esperado);
}
let hashFicticio;
/**
 * Se compara contra esto cuando el correo no existe, para que responder "credenciales
 * inválidas" tarde lo mismo exista o no la cuenta (no se puede enumerar correos por tiempo).
 */
export async function verificarContrasenaFicticia(contrasena) {
    hashFicticio ??= hashContrasena("contraseña-ficticia-que-nadie-usa");
    await verificarContrasena(contrasena, await hashFicticio);
}
