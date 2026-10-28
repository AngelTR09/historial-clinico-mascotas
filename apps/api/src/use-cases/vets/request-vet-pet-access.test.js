import "../../env.js";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorProhibido, ErrorNoEncontrado } from "../../domain/errors.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoYMascotaAislados, crearVeterinarioAislado } from "../../test-support/fixtures.js";
import { solicitarAccesoVeterinarioMascota } from "./request-vet-pet-access.js";
function puertosFalsos() {
    return {
        autenticacion: {
            issueVetPetAccessToken: async (idVeterinario, idMascota) => ({
                token: `access-${idVeterinario}-${idMascota}`,
                expiraEn: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            }),
        },
    };
}
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("solicitarAccesoVeterinarioMascota", () => {
    it("emite un acceso acotado a la mascota escaneada cuando el veterinario está aprobado (RN 10)", async () => {
        const { idMascota, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador, "aprobado");
        const result = await solicitarAccesoVeterinarioMascota(puertosFalsos(), veterinario.id, tokenQr);
        expect(result.idMascota).toBe(idMascota);
        expect(result.token).toBe(`access-${veterinario.id}-${idMascota}`);
        expect(new Date(result.expiraEn).getTime()).toBeGreaterThan(Date.now());
    });
    it("rechaza con ErrorProhibido si la cuenta del veterinario no está aprobada", async () => {
        const { tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador, "pendiente");
        await expect(solicitarAccesoVeterinarioMascota(puertosFalsos(), veterinario.id, tokenQr)).rejects.toThrow(ErrorProhibido);
    });
    it("rechaza con ErrorNoEncontrado si el token QR no corresponde a ninguna mascota", async () => {
        const veterinario = await crearVeterinarioAislado(rastreador, "aprobado");
        await expect(solicitarAccesoVeterinarioMascota(puertosFalsos(), veterinario.id, "token-que-no-existe")).rejects.toThrow(ErrorNoEncontrado);
    });
});
