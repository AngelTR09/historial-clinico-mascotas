import "../../env.js";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorNoEncontrado } from "../../domain/errors.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoYMascotaAislados } from "../../test-support/fixtures.js";
import { enviarSolicitudContactoPublico } from "./submit-public-contact-request.js";
function puertosFalsos(notify) {
    return {
        notificacion: {
            notify: async (input) => {
                notify(input);
            },
        },
    };
}
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("enviarSolicitudContactoPublico", () => {
    it("enruta el mensaje por PuertoNotificacion sin exponer el correo del dueño al llamador", async () => {
        const { idMascota, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        let notificado;
        const result = await enviarSolicitudContactoPublico(puertosFalsos((input) => {
            notificado = input;
        }), { tokenQr, nombreContacto: "Alguien", canalContacto: "999888777", mensaje: "La encontré cerca del parque" });
        expect(result.idMascota).toBe(idMascota);
        expect(notificado?.to).toContain("@");
        expect(notificado?.data.mensaje).toBe("La encontré cerca del parque");
    });
    it("lanza ErrorNoEncontrado si el tokenQr no existe", async () => {
        await expect(enviarSolicitudContactoPublico(puertosFalsos(() => { }), {
            tokenQr: "token-inexistente",
            nombreContacto: "Alguien",
            canalContacto: "999888777",
            mensaje: "hola",
        })).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });
});
