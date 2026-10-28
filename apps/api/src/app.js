import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { config } from "./config.js";
import { rutasAdjuntos } from "./routes/attachments.js";
import { rutasAutenticacion } from "./routes/auth.js";
import { rutasEventosSalud } from "./routes/health-events.js";
import { rutasAlmacenamientoLocal } from "./routes/local-storage.js";
import { rutasDuenos } from "./routes/owners.js";
import { rutasMascotas } from "./routes/pets.js";
import { rutasPublicas } from "./routes/public.js";
import { rutasRecordatorios } from "./routes/reminders.js";
import { rutasTransferencias } from "./routes/transfers.js";
import { rutasVistaVeterinario } from "./routes/vet-view.js";
import { rutasVeterinarios } from "./routes/vets.js";
import { ErrorDominio } from "./domain/errors.js";
import { OPCIONES_REDACCION } from "./logging.js";
import { registrarLimiteDeSolicitudes } from "./plugins/rate-limit.js";
export async function buildApp(ports, opciones = {}) {
    const { limiteAutenticacionPorMinuto = config.LIMITE_AUTENTICACION_POR_MINUTO, ahora } = opciones;
    const app = Fastify({
        // Tras CloudFront y el ALB la IP real viaja en X-Forwarded-For; sin esto el límite y la auditoría verían
        // siempre la IP del balanceador. Solo se confía en AWS, donde el ALB únicamente acepta a CloudFront.
        trustProxy: config.PROVEEDOR === "aws",
        bodyLimit: 10 * 1024 * 1024,
        logger: {
            level: "info",
            redact: OPCIONES_REDACCION,
        },
    });
    // Inventario de rutas registradas, para que los tests detecten una ruta nueva sin autenticación.
    const rutasRegistradas = [];
    app.addHook("onRoute", (ruta) => {
        for (const metodo of [ruta.method].flat()) {
            if (metodo !== "HEAD" && metodo !== "OPTIONS") rutasRegistradas.push({ metodo, url: ruta.url });
        }
    });
    app.decorate("rutasRegistradas", rutasRegistradas);
    await app.register(cors, { origin: true });
    registrarLimiteDeSolicitudes(app, { maximoPorMinuto: limiteAutenticacionPorMinuto, ahora });
    app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, payload, done) => {
        done(null, payload);
    });
    app.setErrorHandler((error, _request, reply) => {
        if (error instanceof ErrorDominio) {
            reply.code(error.codigoEstado).send({ error: error.message });
            return;
        }
        if (error instanceof ZodError) {
            reply.code(400).send({ error: "Datos de entrada inválidos", issues: error.issues });
            return;
        }
        app.log.error(error);
        reply.code(500).send({ error: "Error interno" });
    });
    app.get("/health", async () => ({ status: "ok" }));
    await app.register(rutasAutenticacion, { ports });
    await app.register(rutasDuenos, { ports });
    await app.register(rutasMascotas, { ports });
    await app.register(rutasEventosSalud, { ports });
    await app.register(rutasAdjuntos, { ports });
    await app.register(rutasPublicas, { ports });
    await app.register(rutasVeterinarios, { ports });
    await app.register(rutasVistaVeterinario, { ports });
    await app.register(rutasTransferencias, { ports });
    await app.register(rutasRecordatorios, { ports });
    // Solo el adaptador local de almacenamiento sirve archivos; en AWS suben y bajan directo a S3.
    if (config.PROVEEDOR === "local") {
        await app.register(rutasAlmacenamientoLocal);
    }
    return app;
}
