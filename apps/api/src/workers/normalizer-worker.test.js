import "../env.js";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { AdaptadorColaEnMemoria } from "../adapters/local/in-memory-queue-adapter.js";
import { db } from "../db/client.js";
import { colaCuracion, eventosSalud, mascotas } from "../db/schema.js";
import { registrarTrabajadorNormalizador } from "./normalizer-worker.js";
/** Reintenta `consulta` hasta que devuelva algo útil: el worker es asíncrono y un runner lento tarda más de 50 ms. */
async function esperarResultado(consulta, limiteMs = 3000) {
    const inicio = Date.now();
    for (;;) {
        const resultado = await consulta();
        if (resultado || Date.now() - inicio > limiteMs)
            {return resultado;}
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
}
const idsEventosCreados = [];
const idsCuracionCreados = [];
afterEach(async () => {
    for (const id of idsEventosCreados.splice(0)) {
        await db.delete(eventosSalud).where(eq(eventosSalud.id, id));
    }
    for (const id of idsCuracionCreados.splice(0)) {
        await db.delete(colaCuracion).where(eq(colaCuracion.id, id));
    }
});
async function insertarEventoVacuna(idMascota, idDueno, texto) {
    const [insertado] = await db
        .insert(eventosSalud)
        .values({
        idMascota,
        tipo: "vacuna",
        fechaEvento: "2026-01-01",
        textoOriginal: texto,
        claveIdempotencia: crypto.randomUUID(),
        creadoPor: idDueno,
    })
        .returning();
    idsEventosCreados.push(insertado.id);
    return insertado;
}
describe("registrarTrabajadorNormalizador", () => {
    it("asigna vacuna_canonica_id cuando el texto libre coincide con el catálogo", async () => {
        const [mascotaSembrada] = await db.select().from(mascotas).where(eq(mascotas.especie, "perro")).limit(1);
        if (!mascotaSembrada)
            {throw new Error("Se necesita al menos una mascota perro sembrada; corre `pnpm db:seed`.");}
        const cola = new AdaptadorColaEnMemoria();
        registrarTrabajadorNormalizador({ cola });
        const evento = await insertarEventoVacuna(mascotaSembrada.id, mascotaSembrada.idDueno, "vacuna antirrabica");
        cola.enqueue("normalizer", { idEvento: evento.id, textoOriginal: evento.textoOriginal, species: mascotaSembrada.especie });
        const actualizado = await esperarResultado(async () => {
            const [fila] = await db
                .select({ vacunaCanonicaId: eventosSalud.vacunaCanonicaId })
                .from(eventosSalud)
                .where(eq(eventosSalud.id, evento.id));
            return fila?.vacunaCanonicaId ? fila : null;
        });
        expect(actualizado?.vacunaCanonicaId).toBeTruthy();
    });
    it("deja el texto en curation_queue cuando no hay match confiable", async () => {
        const [mascotaSembrada] = await db.select().from(mascotas).where(eq(mascotas.especie, "perro")).limit(1);
        if (!mascotaSembrada)
            {throw new Error("Se necesita al menos una mascota perro sembrada; corre `pnpm db:seed`.");}
        const cola = new AdaptadorColaEnMemoria();
        registrarTrabajadorNormalizador({ cola });
        const textoInventado = `vacuna rara de prueba ${crypto.randomUUID()}`;
        const evento = await insertarEventoVacuna(mascotaSembrada.id, mascotaSembrada.idDueno, textoInventado);
        cola.enqueue("normalizer", { idEvento: evento.id, textoOriginal: evento.textoOriginal, species: mascotaSembrada.especie });
        const curado = await esperarResultado(async () => {
            const [fila] = await db.select().from(colaCuracion).where(eq(colaCuracion.textoOriginal, textoInventado));
            return fila;
        });
        expect(curado).toBeDefined();
        expect(curado?.ocurrencias).toBe(1);
        if (curado)
            {idsCuracionCreados.push(curado.id);}
        const [actualizado] = await db
            .select({ vacunaCanonicaId: eventosSalud.vacunaCanonicaId })
            .from(eventosSalud)
            .where(eq(eventosSalud.id, evento.id));
        expect(actualizado?.vacunaCanonicaId).toBeNull();
    });
});
