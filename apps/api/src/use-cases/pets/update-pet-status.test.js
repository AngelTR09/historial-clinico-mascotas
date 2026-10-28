import "../../env.js";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { mascotas } from "../../db/schema.js";
import { ErrorNoEncontrado } from "../../domain/errors.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoAislado, crearDuenoYMascotaAislados } from "../../test-support/fixtures.js";
import { actualizarEstadoMascota } from "./update-pet-status.js";
import { crearPuertosDePrueba } from "../../test-support/ports.js";
const { ports } = crearPuertosDePrueba();
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("actualizarEstadoMascota", () => {
    it("marca una mascota como extraviada y la revierte a activa", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const extraviada = await actualizarEstadoMascota(ports, idDueno, idMascota, { estado: "extraviada" });
        expect(extraviada.estado).toBe("extraviada");
        const recuperada = await actualizarEstadoMascota(ports, idDueno, idMascota, { estado: "activa" });
        expect(recuperada.estado).toBe("activa");
    });
    it("fija extraviadaDesde con la fecha de hoy al extraviarse, la conserva y la limpia al recuperarse", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const hoyEnLima = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
        const extraviada = await actualizarEstadoMascota(ports, idDueno, idMascota, { estado: "extraviada" });
        expect(extraviada.extraviadaDesde).toBe(hoyEnLima);
        await db.update(mascotas).set({ extraviadaDesde: "2026-01-05" }).where(eq(mascotas.id, idMascota));
        const repetida = await actualizarEstadoMascota(ports, idDueno, idMascota, { estado: "extraviada" });
        expect(repetida.extraviadaDesde).toBe("2026-01-05");
        const recuperada = await actualizarEstadoMascota(ports, idDueno, idMascota, { estado: "activa" });
        expect(recuperada.extraviadaDesde).toBeNull();
    });
    it("rechaza el cambio si la mascota no pertenece a ese dueño", async () => {
        const { idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const otroDueno = await crearDuenoAislado(rastreador);
        await expect(actualizarEstadoMascota(ports, otroDueno.id, idMascota, { estado: "extraviada" })).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });
    it("lanza ErrorNoEncontrado si la mascota no existe", async () => {
        const owner = await crearDuenoAislado(rastreador);
        await expect(actualizarEstadoMascota(ports, owner.id, "00000000-0000-0000-0000-000000000000", { estado: "extraviada" })).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });
});
