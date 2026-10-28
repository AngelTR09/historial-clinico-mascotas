import "../../env.js";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { catalogoVacunas } from "../../db/schema.js";
import { limpiarFixtures, crearRastreadorFixtures, crearEventoSaludAislado, crearDuenoYMascotaAislados } from "../../test-support/fixtures.js";
import { listarRecordatoriosDueno } from "./list-owner-reminders.js";
function fechaHaceNDias(dias) {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString().slice(0, 10);
}
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
async function crearDuenoConVacunaVencida() {
    const { idDueno, idMascota, nombreMascota } = await crearDuenoYMascotaAislados(rastreador, "perro");
    const [entradaCatalogo] = await db.select().from(catalogoVacunas).where(eq(catalogoVacunas.especie, "perro")).limit(1);
    if (!entradaCatalogo)
        {throw new Error("Se necesita el catálogo canónico sembrado; corre `pnpm db:seed`.");}
    await crearEventoSaludAislado(rastreador, {
        idMascota,
        idDueno,
        tipo: "vacuna",
        textoOriginal: entradaCatalogo.nombreCanonico,
        fechaEvento: fechaHaceNDias(entradaCatalogo.mesesVigencia * 30 + 30),
        vacunaCanonicaId: entradaCatalogo.id,
    });
    return { idDueno, idMascota, nombreMascota };
}
describe("listarRecordatoriosDueno", () => {
    it("solo devuelve los recordatorios de las mascotas de ese dueño, no las de otro", async () => {
        const duenoA = await crearDuenoConVacunaVencida();
        const duenoB = await crearDuenoConVacunaVencida();
        const recordatoriosA = await listarRecordatoriosDueno(duenoA.idDueno);
        const recordatoriosB = await listarRecordatoriosDueno(duenoB.idDueno);
        expect(recordatoriosA.some((r) => r.idMascota === duenoA.idMascota)).toBe(true);
        expect(recordatoriosA.some((r) => r.idMascota === duenoB.idMascota)).toBe(false);
        expect(recordatoriosB.some((r) => r.idMascota === duenoB.idMascota)).toBe(true);
        expect(recordatoriosB.some((r) => r.idMascota === duenoA.idMascota)).toBe(false);
    });

    it("incluye las desparasitaciones por vencer del dueño, marcadas con su tipo", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador, "perro");
        await crearEventoSaludAislado(rastreador, { idMascota, idDueno, tipo: "desparasitacion", fechaEvento: fechaHaceNDias(100) });
        const recordatorios = await listarRecordatoriosDueno(idDueno);
        expect(recordatorios).toEqual([expect.objectContaining({ idMascota, vacuna: "Desparasitación", tipo: "desparasitacion" })]);
    });
});
