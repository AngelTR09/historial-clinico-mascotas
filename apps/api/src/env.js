import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Carga el `.env` de la raíz del monorepo antes de que `config.js` valide
 * `process.env`. Se resuelve desde la ubicación del archivo, no desde el
 * cwd, porque pnpm ejecuta los scripts de cada paquete con su propio cwd.
 */
const aqui = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(aqui, "../../../.env") });
