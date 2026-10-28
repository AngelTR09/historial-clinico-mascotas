import "../env.js";
import { config } from "../config.js";
import { revertirMigraciones } from "./migration-runner.js";
import { exigirBaseLocal } from "./local-guard.js";
/**
 * Uso: pnpm --filter @hcm/api db:rollback [n]   (por defecto 1)
 * Antes de revertir en cualquier base con datos que importen: pnpm db:backup.
 */
exigirBaseLocal(config.DATABASE_URL, "db:rollback");
const cantidad = Number(process.argv[2] ?? 1);
if (!Number.isInteger(cantidad) || cantidad < 1) {
    console.error("Uso: db:rollback [n] con n entero >= 1");
    process.exit(1);
}
const revertidas = await revertirMigraciones(config.DATABASE_URL, cantidad);
console.log(revertidas.length ? `Revertidas: ${revertidas.join(", ")}` : "No había migraciones aplicadas.");
