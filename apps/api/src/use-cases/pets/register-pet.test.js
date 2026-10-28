import "../../env.js";
import { esCodigoPublicoValido } from "@hcm/shared";
import { afterEach, describe, expect, it } from "vitest";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoAislado } from "../../test-support/fixtures.js";
import { registrarMascota } from "./register-pet.js";
import { crearPuertosDePrueba } from "../../test-support/ports.js";
const { ports } = crearPuertosDePrueba();
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("registrarMascota", () => {
    it("genera un public_code con dígito verificador válido y un qr_token opaco distinto de él", async () => {
        const owner = await crearDuenoAislado(rastreador);
        const mascota = await registrarMascota(ports, owner.id, { nombre: "Rocky", especie: "perro" });
        rastreador.petIds.push(mascota.id);
        expect(esCodigoPublicoValido(mascota.codigoPublico)).toBe(true);
        expect(mascota.tokenQr).not.toBe(mascota.codigoPublico);
        // 16 bytes en base64url no llevan relleno "=" y no coinciden con el patrón numérico del public_code.
        expect(mascota.tokenQr).toMatch(/^[A-Za-z0-9_-]{20,24}$/);
        expect(mascota.estado).toBe("activa");
    });
    it("deja en null los campos opcionales que el dueño no envía", async () => {
        const owner = await crearDuenoAislado(rastreador);
        const mascota = await registrarMascota(ports, owner.id, { nombre: "Michi", especie: "gato" });
        rastreador.petIds.push(mascota.id);
        expect(mascota.raza).toBeNull();
        expect(mascota.sexo).toBeNull();
        expect(mascota.fechaNacimientoAprox).toBeNull();
        expect(mascota.ubigeoDistrito).toBeNull();
    });
    it("dos mascotas seguidas reciben public_code y qr_token distintos", async () => {
        const owner = await crearDuenoAislado(rastreador);
        const primera = await registrarMascota(ports, owner.id, { nombre: "Toby", especie: "perro" });
        const segunda = await registrarMascota(ports, owner.id, { nombre: "Luna", especie: "perro" });
        rastreador.petIds.push(primera.id, segunda.id);
        expect(primera.codigoPublico).not.toBe(segunda.codigoPublico);
        expect(primera.tokenQr).not.toBe(segunda.tokenQr);
    });
});
