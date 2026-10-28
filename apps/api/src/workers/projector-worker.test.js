import "../env.js";
import { afterEach, describe, expect, it } from "vitest";
import { AdaptadorColaEnMemoria } from "../adapters/local/in-memory-queue-adapter.js";
import { AdaptadorProyeccionEnMemoria } from "../adapters/local/in-memory-projection-adapter.js";
import { AdaptadorLecturaPublicaPostgres } from "../adapters/local/postgres-public-read-adapter.js";
import { TEMA_PROYECTOR } from "../domain/temas-cola.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoYMascotaAislados, crearEventoSaludAislado } from "../test-support/fixtures.js";
import { registrarTrabajadorProyector } from "./projector-worker.js";

const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});

function armar() {
    const ports = { cola: new AdaptadorColaEnMemoria(), proyeccion: new AdaptadorProyeccionEnMemoria() };
    registrarTrabajadorProyector(ports);
    return ports;
}

describe("registrarTrabajadorProyector", () => {
    it("proyecta la ficha pública de la mascota con lo mismo que lee el canal local", async () => {
        const { idDueno, idMascota, tokenQr } = await crearDuenoYMascotaAislados(rastreador, "perro", { colorSenas: "mancha blanca", claveFoto: `pets/${crypto.randomUUID()}/foto.jpg` });
        await crearEventoSaludAislado(rastreador, { idMascota, idDueno, tipo: "vacuna", textoOriginal: "Antirrábica" });
        const ports = armar();

        ports.cola.enqueue(TEMA_PROYECTOR, { idMascota });
        await ports.cola.esperarVacia();

        const proyectado = ports.proyeccion.obtener(tokenQr);
        const { urlFoto: _urlFoto, actualizadoEn: _a, ...leido } = await new AdaptadorLecturaPublicaPostgres().getPetProfileByQrToken(tokenQr);
        const { claveFoto, actualizadoEn: _b, ...guardado } = proyectado;
        expect(claveFoto).toMatch(/^pets\/.+\/foto\.jpg$/);
        expect(guardado).toEqual(leido);
        expect(proyectado.vacunas.map((v) => v.nombre)).toEqual(["Antirrábica"]);
    });

    it("no publica datos personales ni alertas médicas sin autorización (RN 5)", async () => {
        const { idMascota, tokenQr, ownerEmail } = await crearDuenoYMascotaAislados(rastreador, "gato", { alertasMedicas: "epiléptica", alertasMedicasPublicas: false });
        const ports = armar();

        ports.cola.enqueue(TEMA_PROYECTOR, { idMascota });
        await ports.cola.esperarVacia();

        const proyectado = ports.proyeccion.obtener(tokenQr);
        expect(proyectado.alertasMedicas).toBeNull();
        expect(JSON.stringify(proyectado)).not.toContain(ownerEmail);
    });

    it("es idempotente: repetir el mensaje deja la misma ficha", async () => {
        const { idMascota, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const ports = armar();

        ports.cola.enqueue(TEMA_PROYECTOR, { idMascota });
        ports.cola.enqueue(TEMA_PROYECTOR, { idMascota });
        await ports.cola.esperarVacia();

        expect(ports.proyeccion.obtener(tokenQr).tokenQr).toBe(tokenQr);
        expect(ports.cola.fallidos(TEMA_PROYECTOR)).toEqual([]);
    });

    it("una mascota que ya no existe no es un error ni escribe nada", async () => {
        const ports = armar();
        ports.cola.enqueue(TEMA_PROYECTOR, { idMascota: "00000000-0000-0000-0000-000000000000" });
        await ports.cola.esperarVacia();
        expect(ports.cola.fallidos(TEMA_PROYECTOR)).toEqual([]);
        expect(ports.proyeccion.perfiles.size).toBe(0);
    });

    it("si la proyección falla, el mensaje va a la DLQ en vez de perderse", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const ports = armar();
        ports.proyeccion.guardarPerfil = async () => { throw new Error("DynamoDB no responde"); };
        ports.cola.enqueue(TEMA_PROYECTOR, { idMascota });
        await ports.cola.esperarVacia();
        expect(ports.cola.fallidos(TEMA_PROYECTOR)).toHaveLength(1);
    });
});
