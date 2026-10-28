import "../env.js";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../config.js";
import { aplicarMigraciones, CARPETA_MIGRACIONES, CARPETA_REVERSIONES, etiquetasDeMigraciones, revertirMigraciones } from "./migration-runner.js";

/**
 * Seguridad de migraciones. Corre sobre una base DESECHABLE creada para el test
 * (nunca toca la base de desarrollo). Si el usuario no puede crear bases, el
 * bloque de ejecución se salta; las comprobaciones estáticas corren siempre.
 */
const etiquetas = etiquetasDeMigraciones();

// Migraciones anteriores a esta política, que ya están aplicadas y no se reescriben.
const HEREDADAS_SIN_DEFAULT = new Set(["0001_premium_dark_phoenix"]);

describe("migraciones: reglas estáticas", () => {
    it.each(etiquetas)("%s tiene su reversión en migrations-rollback/", (etiqueta) => {
        expect(existsSync(path.join(CARPETA_REVERSIONES, `${etiqueta}.down.sql`))).toBe(true);
    });

    it("no hay reversiones huérfanas (sin migración que las respalde)", () => {
        const esperadas = new Set(etiquetas.map((e) => `${e}.down.sql`));
        const archivos = readdirSync(CARPETA_REVERSIONES);
        expect(archivos.filter((archivo) => !esperadas.has(archivo))).toEqual([]);
    });

    it.each(etiquetas)("%s no agrega una columna NOT NULL sin DEFAULT (rompe en tablas con datos)", (etiqueta) => {
        if (HEREDADAS_SIN_DEFAULT.has(etiqueta)) return;
        const sql = readFileSync(path.join(CARPETA_MIGRACIONES, `${etiqueta}.sql`), "utf8");
        const peligrosas = sql.split("--> statement-breakpoint").filter((s) => /ADD COLUMN/i.test(s) && /NOT NULL/i.test(s) && !/DEFAULT/i.test(s));
        expect(peligrosas).toEqual([]);
    });
});

describe("migraciones: ciclo subir → bajar → subir en una base desechable", () => {
    const nombreBase = `hcm_migtest_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const urlAdmin = new URL(config.DATABASE_URL);
    urlAdmin.pathname = "/postgres";
    const urlPrueba = new URL(config.DATABASE_URL);
    urlPrueba.pathname = `/${nombreBase}`;
    let admin;
    let puedeCrearBase = true;

    beforeAll(async () => {
        admin = postgres(urlAdmin.toString(), { max: 1, onnotice: () => { } });
        try {
            await admin.unsafe(`CREATE DATABASE "${nombreBase}"`);
        }
        catch {
            puedeCrearBase = false;
        }
    });
    afterAll(async () => {
        if (puedeCrearBase) await admin.unsafe(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`);
        await admin.end();
    });

    async function consultarTablas() {
        const cliente = postgres(urlPrueba.toString(), { max: 1 });
        try {
            const filas = await cliente`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
            return filas.map((f) => f.table_name);
        }
        finally {
            await cliente.end();
        }
    }

    it("aplica todo, revierte todo hasta dejar el esquema vacío y vuelve a aplicar", async (contexto) => {
        if (!puedeCrearBase) contexto.skip();
        await aplicarMigraciones(urlPrueba.toString());
        const tablasCompletas = await consultarTablas();
        expect(tablasCompletas).toEqual(expect.arrayContaining(["owners", "pets", "health_events", "vets", "audit_log"]));

        const revertidas = await revertirMigraciones(urlPrueba.toString(), etiquetas.length);
        expect(revertidas).toEqual([...etiquetas].reverse());
        expect(await consultarTablas()).toEqual([]);

        await aplicarMigraciones(urlPrueba.toString());
        expect(await consultarTablas()).toEqual(tablasCompletas);
    });

    it("revertir una sola migración conserva los datos de las tablas que no toca", async (contexto) => {
        if (!puedeCrearBase) contexto.skip();
        await aplicarMigraciones(urlPrueba.toString());
        const cliente = postgres(urlPrueba.toString(), { max: 1 });
        try {
            await cliente`INSERT INTO owners (doc_type, doc_number_enc, doc_hmac, first_name, last_name, email, consent_at)
                VALUES ('DNI', 'x', ${randomUUID()}, 'Ana', 'Lopez', 'ana@example.com', now())`;
            expect(await revertirMigraciones(urlPrueba.toString(), 1)).toEqual([etiquetas.at(-1)]);
            const [{ total }] = await cliente`SELECT count(*)::int AS total FROM owners`;
            expect(total).toBe(1);
            await aplicarMigraciones(urlPrueba.toString());
        }
        finally {
            await cliente.end();
        }
    });
});
