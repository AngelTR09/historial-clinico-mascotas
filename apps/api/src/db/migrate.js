import "../env.js";
import { config } from "../config.js";
import { aplicarMigraciones } from "./migration-runner.js";
await aplicarMigraciones(config.DATABASE_URL);
console.log("Migraciones aplicadas.");
