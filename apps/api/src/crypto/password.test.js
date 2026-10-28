import { describe, expect, it } from "vitest";
import { hashContrasena, verificarContrasena, verificarContrasenaFicticia } from "./password.js";

describe("contraseñas con scrypt", () => {
    it("el hash no contiene la contraseña y lleva sus parámetros", async () => {
        const hash = await hashContrasena("Clave-Segura-2026!");
        expect(hash).not.toContain("Clave-Segura");
        expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    });

    it("la misma contraseña da hashes distintos (sal propia) y ambos la verifican", async () => {
        const uno = await hashContrasena("Clave-Segura-2026!");
        const dos = await hashContrasena("Clave-Segura-2026!");
        expect(uno).not.toBe(dos);
        expect(await verificarContrasena("Clave-Segura-2026!", uno)).toBe(true);
        expect(await verificarContrasena("Clave-Segura-2026!", dos)).toBe(true);
    });

    it("rechaza una contraseña distinta y un hash mal formado sin lanzar", async () => {
        const hash = await hashContrasena("Clave-Segura-2026!");
        expect(await verificarContrasena("Clave-Segura-2026?", hash)).toBe(false);
        expect(await verificarContrasena("x", "no-es-un-hash")).toBe(false);
        expect(await verificarContrasena("x", "bcrypt$1$2$3$a$b")).toBe(false);
    });

    it("normaliza Unicode: la misma contraseña escrita con otra composición coincide", async () => {
        const hash = await hashContrasena("Contraseña-Única-1!");
        expect(await verificarContrasena("Contraseña-Única-1!".normalize("NFD"), hash)).toBe(true);
    });

    it("la comparación ficticia no lanza (se usa cuando el correo no existe)", async () => {
        await expect(verificarContrasenaFicticia("cualquiera")).resolves.toBeUndefined();
    });
});
