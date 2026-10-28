import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { encolarSubidaPendiente, listarSubidasPendientes, listarSubidasPendientesDeMascota, marcarErrorSubidaPendiente, eliminarSubidaPendiente, } from "./offline-queue";
function fixtureEventoSalud(sobrescrituras = {}) {
    const claveIdempotencia = crypto.randomUUID();
    return {
        clase: "evento-salud",
        id: claveIdempotencia,
        idMascota: "11111111-1111-1111-1111-111111111111",
        datos: {
            idMascota: "11111111-1111-1111-1111-111111111111",
            tipo: "chequeo",
            fechaEvento: "2026-09-01",
            textoOriginal: "Control anual",
            claveIdempotencia,
        },
        creadoEn: new Date().toISOString(),
        intentos: 0,
        ultimoError: null,
        ...sobrescrituras,
    };
}
describe("offline-queue", () => {
    beforeEach(async () => {
        for (const item of await listarSubidasPendientes()) {
            await eliminarSubidaPendiente(item.id);
        }
    });
    it("stores and lists a queued health event", async () => {
        const entrada = fixtureEventoSalud();
        await encolarSubidaPendiente(entrada);
        const todas = await listarSubidasPendientes();
        expect(todas).toHaveLength(1);
        expect(todas[0]).toEqual(entrada);
    });
    it("orders entries by creation time", async () => {
        const anterior = fixtureEventoSalud({ creadoEn: "2026-01-01T00:00:00.000Z" });
        const reciente = fixtureEventoSalud({ creadoEn: "2026-06-01T00:00:00.000Z" });
        await encolarSubidaPendiente(reciente);
        await encolarSubidaPendiente(anterior);
        const todas = await listarSubidasPendientes();
        expect(todas.map((item) => item.id)).toEqual([anterior.id, reciente.id]);
    });
    it("filters by petId", async () => {
        const deMascotaA = fixtureEventoSalud({ idMascota: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
        const deMascotaB = fixtureEventoSalud({ idMascota: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" });
        await encolarSubidaPendiente(deMascotaA);
        await encolarSubidaPendiente(deMascotaB);
        const soloA = await listarSubidasPendientesDeMascota("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        expect(soloA.map((item) => item.id)).toEqual([deMascotaA.id]);
    });
    it("removes an entry once synced", async () => {
        const entrada = fixtureEventoSalud();
        await encolarSubidaPendiente(entrada);
        await eliminarSubidaPendiente(entrada.id);
        expect(await listarSubidasPendientes()).toHaveLength(0);
    });
    it("records the error and bumps attempts without dropping the entry", async () => {
        const entrada = fixtureEventoSalud();
        await encolarSubidaPendiente(entrada);
        await marcarErrorSubidaPendiente(entrada.id, "422 datos inválidos");
        const [actualizada] = await listarSubidasPendientes();
        expect(actualizada?.intentos).toBe(1);
        expect(actualizada?.ultimoError).toBe("422 datos inválidos");
    });
});
