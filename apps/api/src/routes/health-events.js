import { esquemaCreacionEventoSalud, esquemaCreacionEventoSaludVeterinario } from "@hcm/shared";
import { z } from "zod";
import { registrarAuditoria } from "../audit/record-audit.js";
import { fabricaExigirAccesoVeterinarioMascota, fabricaExigirDueno } from "../plugins/auth.js";
import { listarEventosSaludMascota } from "../use-cases/health/list-pet-health-events.js";
import { registrarEventoSalud, registrarEventoSaludVeterinario } from "../use-cases/health/register-health-event.js";
const esquemaParametrosListado = z.object({ idMascota: z.string().uuid() });
export async function rutasEventosSalud(app, opts) {
    const exigirDueno = fabricaExigirDueno(opts.ports);
    const exigirAccesoVeterinarioMascota = fabricaExigirAccesoVeterinarioMascota(opts.ports);
    app.post("/health-events", { preHandler: exigirDueno }, async (request, reply) => {
        const input = esquemaCreacionEventoSalud.parse(request.body);
        const evento = await registrarEventoSalud(opts.ports, request.idDueno, input);
        await registrarAuditoria({ tipoActor: "dueno", idActor: request.idDueno, idMascota: evento.idMascota, accion: "crear_evento_salud", ip: request.ip });
        reply.code(201);
        return evento;
    });
    app.get("/pets/:idMascota/health-events", { preHandler: exigirDueno }, async (request) => {
        const { idMascota } = esquemaParametrosListado.parse(request.params);
        const eventos = await listarEventosSaludMascota(request.idDueno, idMascota);
        await registrarAuditoria({ tipoActor: "dueno", idActor: request.idDueno, idMascota: idMascota, accion: "leer_historial_salud", ip: request.ip });
        return eventos;
    });
    // RN 3: el veterinario con acceso (QR, 4 h) a esta mascota registra directamente; el evento nace `verificado`.
    app.post("/pets/:idMascota/health-events", { preHandler: exigirAccesoVeterinarioMascota }, async (request, reply) => {
        const { idMascota } = esquemaParametrosListado.parse(request.params);
        const input = esquemaCreacionEventoSaludVeterinario.parse(request.body);
        const evento = await registrarEventoSaludVeterinario(opts.ports, request.idVeterinario, idMascota, input);
        await registrarAuditoria({ tipoActor: "veterinario", idActor: request.idVeterinario, idMascota, accion: "crear_evento_salud_veterinario", ip: request.ip });
        reply.code(201);
        return evento;
    });
}
