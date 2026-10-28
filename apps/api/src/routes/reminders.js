import { registrarAuditoria } from "../audit/record-audit.js";
import { fabricaExigirDueno } from "../plugins/auth.js";
import { listarRecordatoriosDueno } from "../use-cases/reminders/list-owner-reminders.js";
export async function rutasRecordatorios(app, opts) {
    const exigirDueno = fabricaExigirDueno(opts.ports);
    app.get("/reminders", { preHandler: exigirDueno }, async (request) => {
        const recordatorios = await listarRecordatoriosDueno(request.idDueno);
        await registrarAuditoria({ tipoActor: "dueno", idActor: request.idDueno, idMascota: null, accion: "listar_recordatorios", ip: request.ip });
        return recordatorios;
    });
}
