import "./env.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { construirPuertos } from "./container.js";
import { registrarTrabajadorCargaMasivaMascotas } from "./workers/bulk-pet-upload-worker.js";
import { registrarTrabajadorNormalizador } from "./workers/normalizer-worker.js";
import { registrarTrabajadorOcr } from "./workers/ocr-worker.js";
import { registrarTrabajadorProyector } from "./workers/projector-worker.js";
// En AWS `subscribe` no hace nada: los workers corren como Lambdas, no en este proceso.
const ports = await construirPuertos();
registrarTrabajadorOcr(ports);
registrarTrabajadorNormalizador(ports);
registrarTrabajadorProyector(ports);
registrarTrabajadorCargaMasivaMascotas(ports);
const app = await buildApp(ports);
await app.listen({ port: config.PORT, host: "0.0.0.0" });
