import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { config } from "../config.js";
const ALGORITMO = "aes-256-gcm";
const BYTES_IV = 12;
function claveCifrado() {
    const key = Buffer.from(config.DOC_ENCRYPTION_KEY, "base64");
    if (key.length !== 32) {
        throw new Error("DOC_ENCRYPTION_KEY debe decodificar a 32 bytes (AES-256)");
    }
    return key;
}
/** Cifra un valor sensible (RN 4: el documento nunca se guarda en texto plano). */
export function encryptSecret(plainText) {
    const iv = randomBytes(BYTES_IV);
    const cipher = createCipheriv(ALGORITMO, claveCifrado(), iv);
    const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}
export function decryptSecret(encoded) {
    const raw = Buffer.from(encoded, "base64");
    const iv = raw.subarray(0, BYTES_IV);
    const authTag = raw.subarray(BYTES_IV, BYTES_IV + 16);
    const ciphertext = raw.subarray(BYTES_IV + 16);
    const decipher = createDecipheriv(ALGORITMO, claveCifrado(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
/** RN 4: se indexa por HMAC-SHA256(documento + pepper), nunca por el valor en claro. */
export function hmacWithPepper(value) {
    return createHmac("sha256", config.DOC_HMAC_PEPPER).update(value).digest("hex");
}
