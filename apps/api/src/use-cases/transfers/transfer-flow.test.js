import "../../env.js";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { mascotas, transferencias } from "../../db/schema.js";
import { ErrorConflicto, ErrorNoEncontrado, ErrorProhibido } from "../../domain/errors.js";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoAislado, crearDuenoYMascotaAislados } from "../../test-support/fixtures.js";
import { cancelarTransferencia } from "./cancel-transfer.js";
import { crearTransferencia } from "./create-transfer.js";
import { canjearTransferencia } from "./redeem-transfer.js";
const rastreador = crearRastreadorFixtures();
const idsTransferenciasCreadas = [];
afterEach(async () => {
    for (const id of idsTransferenciasCreadas.splice(0)) {
        await db.delete(transferencias).where(eq(transferencias.id, id));
    }
    await limpiarFixtures(rastreador);
});
/** Mascota y dos dueños propios de este test — nunca se toca el seed, así que no hace falta revertir nada. */
async function mascotaAisladaConDosDuenos() {
    const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
    const otroDueno = await crearDuenoAislado(rastreador);
    return { mascota: { id: idMascota, idDueno }, otroDueno: { id: otroDueno.id } };
}
describe("transferencia de dueño", () => {
    it("crea, canjea y mueve mascotas.owner_id al dueño entrante", async () => {
        const { mascota, otroDueno } = await mascotaAisladaConDosDuenos();
        const { transferencia, codigo } = await crearTransferencia(mascota.idDueno, { idMascota: mascota.id });
        idsTransferenciasCreadas.push(transferencia.id);
        expect(transferencia.estado).toBe("pendiente");
        expect(codigo).toMatch(/^[0-9A-F]{10}$/);
        const canjeada = await canjearTransferencia(otroDueno.id, { idTransferencia: transferencia.id, codigo });
        expect(canjeada.estado).toBe("completada");
        expect(canjeada.idDuenoDestino).toBe(otroDueno.id);
        const [mascotaActualizada] = await db.select({ idDueno: mascotas.idDueno }).from(mascotas).where(eq(mascotas.id, mascota.id)).limit(1);
        expect(mascotaActualizada?.idDueno).toBe(otroDueno.id);
    });
    it("rechaza un código incorrecto sin mover al dueño", async () => {
        const { mascota, otroDueno } = await mascotaAisladaConDosDuenos();
        const { transferencia } = await crearTransferencia(mascota.idDueno, { idMascota: mascota.id });
        idsTransferenciasCreadas.push(transferencia.id);
        await expect(canjearTransferencia(otroDueno.id, { idTransferencia: transferencia.id, codigo: "0000000000" })).rejects.toBeInstanceOf(ErrorProhibido);
    });
    it("rechaza que el propio dueño canjee su transferencia", async () => {
        const { mascota } = await mascotaAisladaConDosDuenos();
        const { transferencia, codigo } = await crearTransferencia(mascota.idDueno, { idMascota: mascota.id });
        idsTransferenciasCreadas.push(transferencia.id);
        await expect(canjearTransferencia(mascota.idDueno, { idTransferencia: transferencia.id, codigo })).rejects.toBeInstanceOf(ErrorProhibido);
    });
    it("no permite canjear dos veces el mismo código", async () => {
        const { mascota, otroDueno } = await mascotaAisladaConDosDuenos();
        const { transferencia, codigo } = await crearTransferencia(mascota.idDueno, { idMascota: mascota.id });
        idsTransferenciasCreadas.push(transferencia.id);
        await canjearTransferencia(otroDueno.id, { idTransferencia: transferencia.id, codigo });
        await expect(canjearTransferencia(otroDueno.id, { idTransferencia: transferencia.id, codigo })).rejects.toBeInstanceOf(ErrorConflicto);
    });
    it("permite cancelar una transferencia pendiente y bloquea canjearla después", async () => {
        const { mascota, otroDueno } = await mascotaAisladaConDosDuenos();
        const { transferencia, codigo } = await crearTransferencia(mascota.idDueno, { idMascota: mascota.id });
        idsTransferenciasCreadas.push(transferencia.id);
        const cancelada = await cancelarTransferencia(mascota.idDueno, transferencia.id);
        expect(cancelada.estado).toBe("cancelada");
        await expect(canjearTransferencia(otroDueno.id, { idTransferencia: transferencia.id, codigo })).rejects.toBeInstanceOf(ErrorConflicto);
    });
    it("no deja que otro dueño cancele una transferencia ajena", async () => {
        const { mascota, otroDueno } = await mascotaAisladaConDosDuenos();
        const { transferencia } = await crearTransferencia(mascota.idDueno, { idMascota: mascota.id });
        idsTransferenciasCreadas.push(transferencia.id);
        await expect(cancelarTransferencia(otroDueno.id, transferencia.id)).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });
});
