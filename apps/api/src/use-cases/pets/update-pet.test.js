import "../../env.js";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorNoEncontrado } from "../../domain/errors.js";
import { crearDuenoAislado, crearDuenoYMascotaAislados, crearRastreadorFixtures, limpiarFixtures } from "../../test-support/fixtures.js";
import { actualizarMascota } from "./update-pet.js";
import { crearPuertosDePrueba } from "../../test-support/ports.js";
const { ports } = crearPuertosDePrueba();
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("actualizarMascota", () => {
    it("guarda los datos nuevos y por defecto no autoriza publicar las alertas médicas", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const mascota = await actualizarMascota(ports, idDueno, idMascota, { colorSenas: "mancha en el ojo", esterilizada: false, alertasMedicas: "epiléptica" });
        expect(mascota).toMatchObject({ colorSenas: "mancha en el ojo", esterilizada: false, alertasMedicas: "epiléptica", alertasMedicasPublicas: false });
    });
    it("conserva lo que no se envía y borra lo que llega como null", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador, "perro", { colorSenas: "negro", temperamento: "dócil" });
        const mascota = await actualizarMascota(ports, idDueno, idMascota, { temperamento: null, notaDelDueno: "Gracias por cuidarla" });
        expect(mascota).toMatchObject({ colorSenas: "negro", temperamento: null, notaDelDueno: "Gracias por cuidarla" });
    });
    it("rechaza la edición si la mascota no pertenece a ese dueño", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const otroDueno = await crearDuenoAislado(rastreador);
        await expect(actualizarMascota(ports, otroDueno.id, idMascota, { colorSenas: "x" })).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });
    it("lanza ErrorNoEncontrado si la mascota no existe", async () => {
        const dueno = await crearDuenoAislado(rastreador);
        await expect(actualizarMascota(ports, dueno.id, "00000000-0000-0000-0000-000000000000", { colorSenas: "x" })).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });
});
