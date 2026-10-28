import "../../env.js";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { mascotas, transferencias } from "../../db/schema.js";
import { ErrorConflicto, ErrorNoEncontrado } from "../../domain/errors.js";
import { crearDuenoAislado, crearDuenoYMascotaAislados, crearRastreadorFixtures, limpiarFixtures } from "../../test-support/fixtures.js";
import { cancelarTransferencia } from "./cancel-transfer.js";
import { crearTransferencia } from "./create-transfer.js";
import { listarEventosSaludMascota } from "../health/list-pet-health-events.js";
import { canjearTransferencia } from "./redeem-transfer.js";

const SOLICITUDES = 20;
const rastreador = crearRastreadorFixtures();

afterEach(async () => {
    if (rastreador.petIds.length > 0) {
        await db.delete(transferencias).where(inArray(transferencias.idMascota, rastreador.petIds));
    }
    await limpiarFixtures(rastreador);
});

async function transferenciasDe(idMascota) {
    return db.select().from(transferencias).where(eq(transferencias.idMascota, idMascota));
}

async function duenoDe(idMascota) {
    const [fila] = await db.select({ idDueno: mascotas.idDueno }).from(mascotas).where(eq(mascotas.id, idMascota));
    return fila.idDueno;
}

describe("RNF 14: 20 solicitudes simultáneas sobre la misma mascota completan una sola transferencia", () => {
    it("20 dueños canjean a la vez el mismo código: se completa 1, la mascota queda con ese dueño y las otras 19 son un conflicto", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const receptores = await Promise.all(Array.from({ length: SOLICITUDES }, () => crearDuenoAislado(rastreador)));
        const { transferencia, codigo } = await crearTransferencia(idDueno, { idMascota });

        const resultados = await Promise.allSettled(receptores.map((receptor) => canjearTransferencia(receptor.id, { idTransferencia: transferencia.id, codigo })));

        const completadas = resultados.filter((r) => r.status === "fulfilled");
        const rechazadas = resultados.filter((r) => r.status === "rejected");
        expect(completadas).toHaveLength(1);
        expect(rechazadas).toHaveLength(SOLICITUDES - 1);
        for (const rechazo of rechazadas) expect(rechazo.reason).toBeInstanceOf(ErrorConflicto);
        const ganador = completadas[0].value.idDuenoDestino;
        expect(await duenoDe(idMascota)).toBe(ganador);
        const filas = await transferenciasDe(idMascota);
        expect(filas).toHaveLength(1);
        expect(filas[0]).toMatchObject({ estado: "completada", idDuenoDestino: ganador });
        expect(filas[0].completadaEn).toBeInstanceOf(Date);
    });

    it("20 solicitudes simultáneas de crear una transferencia dejan una sola pendiente (la base lo garantiza)", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);

        const resultados = await Promise.allSettled(Array.from({ length: SOLICITUDES }, () => crearTransferencia(idDueno, { idMascota })));

        expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        for (const rechazo of resultados.filter((r) => r.status === "rejected")) expect(rechazo.reason).toBeInstanceOf(ErrorConflicto);
        expect((await transferenciasDe(idMascota)).filter((t) => t.estado === "pendiente")).toHaveLength(1);
    });

    it("mientras haya una vigente no se crea otra; se puede cancelar para crear una nueva", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const primera = await crearTransferencia(idDueno, { idMascota });

        await expect(crearTransferencia(idDueno, { idMascota })).rejects.toThrow(ErrorConflicto);
        await cancelarTransferencia(idDueno, primera.transferencia.id);

        await expect(crearTransferencia(idDueno, { idMascota })).resolves.toHaveProperty("codigo");
    });

    it("una pendiente vencida no bloquea: se marca expirada y se crea la nueva", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const vieja = await crearTransferencia(idDueno, { idMascota });
        await db.update(transferencias).set({ expiraEn: new Date(Date.now() - 1000) }).where(eq(transferencias.id, vieja.transferencia.id));

        const nueva = await crearTransferencia(idDueno, { idMascota });

        const filas = await transferenciasDe(idMascota);
        expect(filas.find((t) => t.id === vieja.transferencia.id).estado).toBe("expirada");
        expect(filas.find((t) => t.id === nueva.transferencia.id).estado).toBe("pendiente");
    });

    it("tras completarse, el dueño anterior pierde el acceso y el nuevo lo tiene", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const receptor = await crearDuenoAislado(rastreador);
        const { transferencia, codigo } = await crearTransferencia(idDueno, { idMascota });
        await canjearTransferencia(receptor.id, { idTransferencia: transferencia.id, codigo });

        await expect(listarEventosSaludMascota(idDueno, idMascota)).rejects.toThrow(ErrorNoEncontrado);
        await expect(listarEventosSaludMascota(receptor.id, idMascota)).resolves.toEqual([]);
    });

    it("si la mascota ya no es del dueño que inició la cesión, el canje se revierte entero", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const intruso = await crearDuenoAislado(rastreador);
        const receptor = await crearDuenoAislado(rastreador);
        const { transferencia, codigo } = await crearTransferencia(idDueno, { idMascota });
        await db.update(mascotas).set({ idDueno: intruso.id }).where(eq(mascotas.id, idMascota));

        await expect(canjearTransferencia(receptor.id, { idTransferencia: transferencia.id, codigo })).rejects.toThrow(ErrorConflicto);

        expect(await duenoDe(idMascota)).toBe(intruso.id);
        expect((await transferenciasDe(idMascota))[0]).toMatchObject({ estado: "pendiente", idDuenoDestino: null, completadaEn: null });
    });
});

describe("RNF 17: una falla a mitad de la transferencia deja el expediente y el acceso del dueño anterior sin cambios", () => {
    it("con una falla inyectada justo al mover la mascota, nada cambia y el código sigue sirviendo", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const receptor = await crearDuenoAislado(rastreador);
        const { transferencia, codigo } = await crearTransferencia(idDueno, { idMascota });
        const sufijo = randomUUID().replace(/-/g, "");
        const funcion = `hcm_test_falla_${sufijo}`;
        const disparador = `hcm_test_trg_${sufijo}`;

        // Con la transferencia ya marcada completada dentro de la transacción, el UPDATE de la mascota falla.
        await db.execute(sql.raw(`CREATE FUNCTION ${funcion}() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'falla inyectada'; END; $$ LANGUAGE plpgsql`));
        await db.execute(sql.raw(`CREATE TRIGGER ${disparador} BEFORE UPDATE OF owner_id ON pets FOR EACH ROW WHEN (OLD.id = '${idMascota}') EXECUTE FUNCTION ${funcion}()`));
        try {
            await expect(canjearTransferencia(receptor.id, { idTransferencia: transferencia.id, codigo })).rejects.toThrow();

            expect(await duenoDe(idMascota)).toBe(idDueno);
            expect((await transferenciasDe(idMascota))[0]).toMatchObject({ estado: "pendiente", idDuenoDestino: null, completadaEn: null });
            await expect(listarEventosSaludMascota(idDueno, idMascota)).resolves.toEqual([]);
        }
        finally {
            await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${disparador} ON pets`));
            await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${funcion}()`));
        }

        // Sin la falla, el mismo código se canjea con normalidad: la transferencia no se quemó.
        await expect(canjearTransferencia(receptor.id, { idTransferencia: transferencia.id, codigo })).resolves.toMatchObject({ estado: "completada" });
        expect(await duenoDe(idMascota)).toBe(receptor.id);
    });
});
