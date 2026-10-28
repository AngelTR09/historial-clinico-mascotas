import { esquemaCreacionAdjunto } from "@hcm/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { registrarAuditoria } from "../audit/record-audit.js";
import { db } from "../db/client.js";
import { eventosSalud } from "../db/schema.js";
import { fabricaExigirDueno } from "../plugins/auth.js";
import { registrarAdjunto } from "../use-cases/health/register-attachment.js";
import { solicitarUrlSubidaAdjunto } from "../use-cases/health/request-attachment-upload-url.js";
const esquemaEntradaUrlSubida = z.object({
    idEvento: z.string().uuid(),
    mime: z.string().min(1),
});
async function idMascotaDelEvento(idEvento) {
    const [evento] = await db.select({ idMascota: eventosSalud.idMascota }).from(eventosSalud).where(eq(eventosSalud.id, idEvento)).limit(1);
    return evento?.idMascota ?? null;
}
export async function rutasAdjuntos(app, opts) {
    const exigirDueno = fabricaExigirDueno(opts.ports);
    app.post("/attachments/upload-url", { preHandler: exigirDueno }, async (request) => {
        const input = esquemaEntradaUrlSubida.parse(request.body);
        const result = await solicitarUrlSubidaAdjunto(opts.ports, request.idDueno, input);
        await registrarAuditoria({
            tipoActor: "dueno",
            idActor: request.idDueno,
            idMascota: await idMascotaDelEvento(input.idEvento),
            accion: "solicitar_url_subida_evidencia",
            ip: request.ip,
        });
        return result;
    });
    app.post("/attachments", { preHandler: exigirDueno }, async (request, reply) => {
        const input = esquemaCreacionAdjunto.parse(request.body);
        const adjunto = await registrarAdjunto(opts.ports, request.idDueno, input);
        await registrarAuditoria({
            tipoActor: "dueno",
            idActor: request.idDueno,
            idMascota: await idMascotaDelEvento(input.idEvento),
            accion: "confirmar_evidencia",
            ip: request.ip,
        });
        reply.code(201);
        return adjunto;
    });
}
