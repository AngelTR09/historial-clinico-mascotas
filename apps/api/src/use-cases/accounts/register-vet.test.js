import "../../env.js";
import { esquemaCreacionVeterinario } from "@hcm/shared";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { verificacionesCorreo, veterinarios } from "../../db/schema.js";
import { registrarVeterinario } from "./register-vet.js";
import { eq } from "drizzle-orm";
function puertosFalsos() {
    return {
        notificacion: { notify: async () => { } },
        autenticacion: {
            issueVetToken: async (idVeterinario) => `vet-token-${idVeterinario}`,
        },
    };
}
let contador = 0;
const credenciales = () => ({ correo: `vet-test-${Date.now()}-${contador++}@example.com`, contrasena: "Clave-Segura-2026!" });
const idsVeterinariosCreados = [];
afterEach(async () => {
    for (const id of idsVeterinariosCreados.splice(0)) {
        await db.delete(verificacionesCorreo).where(eq(verificacionesCorreo.idVeterinario, id));
        await db.delete(veterinarios).where(eq(veterinarios.id, id));
    }
});
describe("registrarVeterinario", () => {
    it("crea la cuenta 'pendiente': sin verificación externa, la aprueba una persona", async () => {
        const result = await registrarVeterinario(puertosFalsos(), { pais: "PE", autoridadEmisora: "CMVP", numeroLicencia: "CMVP-1", identificadorFiscal: "20111111111", ...credenciales() });
        idsVeterinariosCreados.push(result.veterinario.id);
        expect(result.veterinario.estado).toBe("pendiente");
        expect(result.veterinario.verificadoEn).toBeNull();
        expect(result.veterinario.razonSocial).toBeNull();
    });
    it("acepta una licencia de otro país y sin identificador fiscal", async () => {
        const result = await registrarVeterinario(puertosFalsos(), { pais: "US", autoridadEmisora: "Texas State Board of Veterinary Medical Examiners", numeroLicencia: "TX-99812", ...credenciales() });
        idsVeterinariosCreados.push(result.veterinario.id);
        expect(result.veterinario).toMatchObject({ pais: "US", numeroLicencia: "TX-99812", identificadorFiscal: null, estado: "pendiente" });
    });
    it("no entrega sesión al registrarse: queda a la espera del código del correo", async () => {
        const result = await registrarVeterinario(puertosFalsos(), { pais: "PE", autoridadEmisora: "CMVP", numeroLicencia: "CMVP-2", ...credenciales() });
        idsVeterinariosCreados.push(result.veterinario.id);
        expect(result.requiereVerificacion).toBe(true);
        expect(result).not.toHaveProperty("token");
    });
});
describe("esquemaCreacionVeterinario", () => {
    const base = { autoridadEmisora: "CMVP", numeroLicencia: "CMVP-1", correo: "vet@example.com", contrasena: "Clave-Segura-2026!" };
    it("normaliza el país a mayúsculas", () => {
        expect(esquemaCreacionVeterinario.parse({ ...base, pais: " pe " }).pais).toBe("PE");
    });
    it("exige 11 dígitos solo al RUC peruano", () => {
        expect(esquemaCreacionVeterinario.safeParse({ ...base, pais: "PE", identificadorFiscal: "123" }).success).toBe(false);
        expect(esquemaCreacionVeterinario.safeParse({ ...base, pais: "US", identificadorFiscal: "12-3456789" }).success).toBe(true);
    });
    it("trata el identificador fiscal vacío como ausente", () => {
        expect(esquemaCreacionVeterinario.parse({ ...base, pais: "PE", identificadorFiscal: "" }).identificadorFiscal).toBeUndefined();
    });
    it("rechaza un país que no es un código de 2 letras", () => {
        expect(esquemaCreacionVeterinario.safeParse({ ...base, pais: "Perú" }).success).toBe(false);
    });
});
