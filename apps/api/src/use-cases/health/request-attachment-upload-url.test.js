import "../../env.js";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorNoEncontrado } from "../../domain/errors.js";
import { limpiarFixtures, crearRastreadorFixtures, crearEventoSaludAislado, crearDuenoYMascotaAislados } from "../../test-support/fixtures.js";
import { solicitarUrlSubidaAdjunto } from "./request-attachment-upload-url.js";
function puertosFalsos() {
    return {
        almacenamiento: {
            getUploadUrl: async (key) => ({ url: `https://storage.local/${key}`, method: "PUT" }),
        },
    };
}
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("solicitarUrlSubidaAdjunto", () => {
    it("delega en PuertoAlmacenamiento una URL de subida directa, sin que el backend reciba el binario (sección 12)", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const idEvento = await crearEventoSaludAislado(rastreador, { idMascota, idDueno });
        const result = await solicitarUrlSubidaAdjunto(puertosFalsos(), idDueno, { idEvento, mime: "image/png" });
        expect(result.method).toBe("PUT");
        expect(result.clave).toContain(idEvento);
        expect(result.url).toBe(`https://storage.local/${result.clave}`);
    });
    it("responde como si no existiera si el evento no pertenece al dueño que pide la URL (RNF 16)", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const otroDueno = await crearDuenoYMascotaAislados(rastreador);
        const idEvento = await crearEventoSaludAislado(rastreador, { idMascota, idDueno: otroDueno.idDueno });
        await expect(solicitarUrlSubidaAdjunto(puertosFalsos(), otroDueno.idDueno, { idEvento, mime: "image/png" })).rejects.toThrow(ErrorNoEncontrado);
    });
    it("rechaza con ErrorNoEncontrado si el evento no existe", async () => {
        const { idDueno } = await crearDuenoYMascotaAislados(rastreador);
        await expect(solicitarUrlSubidaAdjunto(puertosFalsos(), idDueno, { idEvento: crypto.randomUUID(), mime: "image/png" })).rejects.toThrow(ErrorNoEncontrado);
    });
});
