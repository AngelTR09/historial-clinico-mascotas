import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const raizApi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CARPETA_MIGRACIONES = path.join(raizApi, "migrations");
export const CARPETA_REVERSIONES = path.join(raizApi, "migrations-rollback");

/** Etiquetas (`0003_nombre`) de las migraciones en el orden en que se aplican. */
export function etiquetasDeMigraciones() {
    const diario = JSON.parse(readFileSync(path.join(CARPETA_MIGRACIONES, "meta/_journal.json"), "utf8"));
    return diario.entries.map((entrada) => entrada.tag);
}

export async function aplicarMigraciones(url) {
    const cliente = postgres(url, { max: 1, onnotice: () => { } });
    try {
        await migrate(drizzle(cliente), { migrationsFolder: CARPETA_MIGRACIONES });
    }
    finally {
        await cliente.end();
    }
}

/**
 * Revierte las últimas `cantidad` migraciones aplicadas, en orden inverso. Drizzle no genera
 * "down", así que cada migración tiene su par en `migrations-rollback/<etiqueta>.down.sql`.
 * Cada reversión corre en su propia transacción junto con el borrado de su fila en
 * `drizzle.__drizzle_migrations`: o se revierte entera o no se toca nada.
 */
export async function revertirMigraciones(url, cantidad = 1) {
    const etiquetas = etiquetasDeMigraciones();
    const cliente = postgres(url, { max: 1, onnotice: () => { } });
    const revertidas = [];
    try {
        for (let i = 0; i < cantidad; i++) {
            const [{ total }] = await cliente`SELECT count(*)::int AS total FROM drizzle.__drizzle_migrations`;
            if (total === 0) break;
            const etiqueta = etiquetas[total - 1];
            const sentencias = readFileSync(path.join(CARPETA_REVERSIONES, `${etiqueta}.down.sql`), "utf8").split("--> statement-breakpoint");
            await cliente.begin(async (tx) => {
                for (const sentencia of sentencias) await tx.unsafe(sentencia);
                await tx`DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations)`;
            });
            revertidas.push(etiqueta);
        }
    }
    finally {
        await cliente.end();
    }
    return revertidas;
}
