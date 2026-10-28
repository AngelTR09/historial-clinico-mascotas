import "../../env.js";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorConflicto } from "../../domain/errors.js";
import { limpiarFixtures, crearRastreadorFixtures } from "../../test-support/fixtures.js";
import { registrarDueno } from "./register-owner.js";
function puertosFalsos() {
    const enviados = [];
    return {
        enviados,
        notificacion: { notify: async (n) => void enviados.push(n) },
        autenticacion: {
            issueOwnerToken: async (idDueno) => `owner-token-${idDueno}`,
        },
    };
}
function numeroDocumentoUnico() {
    return String(Math.floor(10000000 + Math.random() * 89999999));
}
const CONTRASENA = "Clave-Segura-2026!";
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("registrarDueno", () => {
    it("crea la cuenta con el documento declarado, inactiva y sin sesión hasta verificar el correo", async () => {
        const ports = puertosFalsos();
        const result = await registrarDueno(ports, {
            tipoDocumento: "DNI",
            numeroDocumento: numeroDocumentoUnico(),
            nombres: "Ana",
            apellidos: "Torres",
            correo: `ana-${randomUUID()}@example.com`,
            contrasena: CONTRASENA,
            aceptaTratamientoDatos: true,
        });
        rastreador.ownerIds.push(result.idDueno);
        expect(result.requiereVerificacion).toBe(true);
        expect(result).not.toHaveProperty("token");
        expect(result).not.toHaveProperty("identidadVerificada");
        expect(ports.enviados).toHaveLength(1);
    });
    it("rechaza un segundo alta con el mismo documento", async () => {
        const numeroDocumento = numeroDocumentoUnico();
        const primero = await registrarDueno(puertosFalsos(), {
            tipoDocumento: "DNI",
            numeroDocumento,
            nombres: "Carla",
            apellidos: "Ríos",
            correo: `carla-${randomUUID()}@example.com`,
            contrasena: CONTRASENA,
            aceptaTratamientoDatos: true,
        });
        rastreador.ownerIds.push(primero.idDueno);
        await expect(registrarDueno(puertosFalsos(), {
            tipoDocumento: "DNI",
            numeroDocumento,
            nombres: "Carla",
            apellidos: "Ríos (duplicado)",
            correo: `carla-dup-${randomUUID()}@example.com`,
            contrasena: CONTRASENA,
            aceptaTratamientoDatos: true,
        })).rejects.toThrow(ErrorConflicto);
    });
});
