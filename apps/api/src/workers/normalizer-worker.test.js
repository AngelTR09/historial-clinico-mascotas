import "../env.js";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdaptadorColaEnMemoria } from "../adapters/local/in-memory-queue-adapter.js";
import { db } from "../db/client.js";
import { colaCuracion, eventosSalud, mascotas } from "../db/schema.js";
import { reencolarNormalizacionesPendientes } from "./normalization-sweep.js";
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

    it("SQS entrega al menos una vez: el mismo mensaje repetido no suma dos ocurrencias a la curaduría", async () => {
        const [mascotaSembrada] = await db.select().from(mascotas).where(eq(mascotas.especie, "perro")).limit(1);
        const cola = new AdaptadorColaEnMemoria();
        registrarTrabajadorNormalizador({ cola });
        const textoInventado = `vacuna rara de prueba ${crypto.randomUUID()}`;
        const evento = await insertarEventoVacuna(mascotaSembrada.id, mascotaSembrada.idDueno, textoInventado);
        const mensaje = { idEvento: evento.id, textoOriginal: evento.textoOriginal, species: mascotaSembrada.especie };
        cola.enqueue("normalizer", mensaje);
        cola.enqueue("normalizer", mensaje);
        await cola.esperarVacia();
        const [curado] = await db.select().from(colaCuracion).where(eq(colaCuracion.textoOriginal, textoInventado));
        idsCuracionCreados.push(curado.id);
        expect(curado.ocurrencias).toBe(1);
        const [marcado] = await db.select({ normalizadoEn: eventosSalud.normalizadoEn }).from(eventosSalud).where(eq(eventosSalud.id, evento.id));
        expect(marcado.normalizadoEn).toBeInstanceOf(Date);
    });

    it("en una Lambda espera el pedido de reproyección antes de terminar (si no, se pierde al congelarse)", async () => {
        const [mascotaSembrada] = await db.select().from(mascotas).where(eq(mascotas.especie, "perro")).limit(1);
        let proyeccionEnviada = false;
        let manejador;
        const cola = {
            subscribe: (_tema, m) => { manejador = m; },
            enqueue: () => new Promise((resolver) => setTimeout(() => { proyeccionEnviada = true; resolver(); }, 30)),
        };
        registrarTrabajadorNormalizador({ cola });
        const evento = await insertarEventoVacuna(mascotaSembrada.id, mascotaSembrada.idDueno, "vacuna antirrabica");
        await manejador({ idEvento: evento.id, textoOriginal: evento.textoOriginal, species: mascotaSembrada.especie });
        expect(proyeccionEnviada).toBe(true);
    });
});

describe("reencolarNormalizacionesPendientes (un mensaje de normalización perdido no deja la vacuna sin recordatorio)", () => {
    const enUnaHora = () => new Date(Date.now() + 60 * 60_000);

    it("vuelve a encolar la vacuna que nadie atendió, y el normalizador la vincula", async () => {
        const [mascotaSembrada] = await db.select().from(mascotas).where(eq(mascotas.especie, "perro")).limit(1);
        // La API registró la vacuna pero SQS rechazó el mensaje: nunca llegó al normalizador.
        const evento = await insertarEventoVacuna(mascotaSembrada.id, mascotaSembrada.idDueno, "vacuna antirrabica");
        const cola = new AdaptadorColaEnMemoria();
        registrarTrabajadorNormalizador({ cola });
        const resultado = await reencolarNormalizacionesPendientes({ cola }, { ahora: enUnaHora() });
        await cola.esperarVacia();
        expect(resultado.reencolados).toBeGreaterThanOrEqual(1);
        const [fila] = await db.select().from(eventosSalud).where(eq(eventosSalud.id, evento.id));
        expect(fila.vacunaCanonicaId).toBeTruthy();
        expect(fila.normalizadoEn).toBeInstanceOf(Date);
    });

    it("no toca un evento recién creado (su mensaje sigue en la cola) ni uno ya atendido", async () => {
        const [mascotaSembrada] = await db.select().from(mascotas).where(eq(mascotas.especie, "perro")).limit(1);
        const reciente = await insertarEventoVacuna(mascotaSembrada.id, mascotaSembrada.idDueno, "vacuna antirrabica");
        const encolados = [];
        const cola = { enqueue: async (_tema, payload) => void encolados.push(payload.idEvento) };
        await reencolarNormalizacionesPendientes({ cola });
        expect(encolados).not.toContain(reciente.id);

        await db.update(eventosSalud).set({ normalizadoEn: new Date() }).where(eq(eventosSalud.id, reciente.id));
        await reencolarNormalizacionesPendientes({ cola }, { ahora: enUnaHora() });
        expect(encolados).not.toContain(reciente.id);
    });

    it("si la cola sigue caída lo cuenta como fallido y el evento queda pendiente para el siguiente barrido", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const [mascotaSembrada] = await db.select().from(mascotas).where(eq(mascotas.especie, "perro")).limit(1);
        const evento = await insertarEventoVacuna(mascotaSembrada.id, mascotaSembrada.idDueno, "vacuna antirrabica");
        const resultado = await reencolarNormalizacionesPendientes({ cola: { enqueue: () => Promise.reject(new Error("SQS no responde")) } }, { ahora: enUnaHora() });
        expect(resultado.fallidos).toBeGreaterThanOrEqual(1);
        const [fila] = await db.select({ normalizadoEn: eventosSalud.normalizadoEn }).from(eventosSalud).where(eq(eventosSalud.id, evento.id));
        expect(fila.normalizadoEn).toBeNull();
        vi.restoreAllMocks();
    });
});
