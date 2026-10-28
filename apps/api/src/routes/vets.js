import { esquemaCreacionVeterinario, esquemaRegistroMascotaPorVeterinario, esquemaSolicitudAccesoVeterinarioMascota } from "@hcm/shared";
import { eq } from "drizzle-orm";
import { registrarAuditoria } from "../audit/record-audit.js";
import { db } from "../db/client.js";
import { veterinarios } from "../db/schema.js";
import { fabricaExigirVeterinario } from "../plugins/auth.js";
import { registrarMascotaPorVeterinario } from "../use-cases/vets/register-pet-by-vet.js";
import { registrarVeterinario } from "../use-cases/accounts/register-vet.js";
import { solicitarAccesoVeterinarioMascota } from "../use-cases/vets/request-vet-pet-access.js";
export async function rutasVeterinarios(app, opts) {
    const exigirVeterinario = fabricaExigirVeterinario(opts.ports);
    app.post("/vets", async (request, reply) => {
        const input = esquemaCreacionVeterinario.parse(request.body);
        const result = await registrarVeterinario(opts.ports, input);
        reply.code(201);
        return result;
    });
    app.get("/vets/me", { preHandler: exigirVeterinario }, async (request) => {
        const [veterinario] = await db.select().from(veterinarios).where(eq(veterinarios.id, request.idVeterinario)).limit(1);
        return veterinario;
    });
    app.post("/vets/pet-access", { preHandler: exigirVeterinario }, async (request) => {
        const input = esquemaSolicitudAccesoVeterinarioMascota.parse(request.body);
        const result = await solicitarAccesoVeterinarioMascota(opts.ports, request.idVeterinario, input.tokenQr);
        await registrarAuditoria({
            tipoActor: "veterinario",
            idActor: request.idVeterinario,
            idMascota: result.idMascota,
            accion: "solicitar_acceso_validador",
            ip: request.ip,
        });
        return result;
    });
    app.post("/vets/pets", { preHandler: exigirVeterinario }, async (request, reply) => {
        const input = esquemaRegistroMascotaPorVeterinario.parse(request.body);
        const result = await registrarMascotaPorVeterinario(opts.ports, request.idVeterinario, input);
        await registrarAuditoria({
            tipoActor: "veterinario",
            idActor: request.idVeterinario,
            idMascota: result.idMascota,
            accion: "registrar_mascota_veterinario",
            ip: request.ip,
        });
        reply.code(201);
        return result;
    });
}
