import "../env.js";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hmacWithPepper } from "./symmetric.js";
describe("symmetric crypto", () => {
    it("descifra lo que cifró", () => {
        const plano = "45678912";
        expect(decryptSecret(encryptSecret(plano))).toBe(plano);
    });
    it("produce ciphertext distinto en cada llamada (IV aleatorio)", () => {
        const plano = "45678912";
        expect(encryptSecret(plano)).not.toBe(encryptSecret(plano));
    });
    it("el HMAC es determinístico para el mismo valor", () => {
        expect(hmacWithPepper("45678912")).toBe(hmacWithPepper("45678912"));
    });
    it("el HMAC cambia si cambia el documento", () => {
        expect(hmacWithPepper("45678912")).not.toBe(hmacWithPepper("45678913"));
    });
});
