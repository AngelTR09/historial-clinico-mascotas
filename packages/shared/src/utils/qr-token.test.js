import { describe, expect, it } from "vitest";
import { extraerTokenQr } from "./qr-token.js";
describe("extraerTokenQr", () => {
    const token = "qwvkKK3ffaUDr2ePQqreUA";
    it("extrae el token de la URL de la ficha pública", () => {
        expect(extraerTokenQr(`http://192.168.1.4:5173/p/${token}`)).toBe(token);
        expect(extraerTokenQr(`https://hcm.example/p/${token}/`)).toBe(token);
    });
    it("conserva los guiones y guiones bajos del token base64url", () => {
        expect(extraerTokenQr("https://hcm.example/p/hK_BTYDaaTirNQpJaACSOw")).toBe("hK_BTYDaaTirNQpJaACSOw");
        expect(extraerTokenQr("https://hcm.example/p/KlpWQ6Dv-vueozIGP7dalg")).toBe("KlpWQ6Dv-vueozIGP7dalg");
    });
    it("devuelve el token suelto sin espacios", () => {
        expect(extraerTokenQr(`  ${token}\n`)).toBe(token);
    });
    it("no toca una URL que no es de una ficha pública", () => {
        expect(extraerTokenQr("https://otro.example/x/abc")).toBe("https://otro.example/x/abc");
    });
});
