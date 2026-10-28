import "../env.js";
import { sql } from "drizzle-orm";
import { db } from "./client.js";
import { config } from "../config.js";
import { exigirBaseLocal } from "./local-guard.js";
import { seed } from "./seed.js";

exigirBaseLocal(config.DATABASE_URL, "db:reset");
/**
 * Solo para desarrollo local: vacía las tablas de dominio (deja el
 * esquema intacto, no toca migraciones) y vuelve a sembrar. Nunca correr
 * contra algo que no sea la base de datos local.
 */
const TABLAS = [
    "audit_log",
    "email_verifications",
    "transfers",
    "curation_queue",
    "attachments",
    "health_events",
    "vaccine_catalog",
    "pets",
    "vets",
    "owners",
];
await db.execute(sql.raw(`TRUNCATE TABLE ${TABLAS.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`));
console.log("Tablas vaciadas.");
await seed();
process.exit(0);
