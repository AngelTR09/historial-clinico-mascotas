import { esquemaCreacionTransferencia, esquemaCanjeTransferencia } from "@hcm/shared";
import { z } from "zod";
import { registrarAuditoria } from "../audit/record-audit.js";
import { cancelarTransferencia } from "../use-cases/transfers/cancel-transfer.js";
import { crearTransferencia } from "../use-cases/transfers/create-transfer.js";
import { canjearTransferencia } from "../use-cases/transfers/redeem-transfer.js";
import { fabricaExigirDueno } from "../plugins/auth.js";
const esquemaParametrosTransferencia = z.object({ idTransferencia: z.string().uuid() });
export async function rutasTransferencias(app, opts) {
    const exigirDueno = fabricaExigirDueno(opts.ports);
    app.post("/transfers", { preHandler: exigirDueno }, async (request, reply) => {
        const input = esquemaCreacionTransferencia.parse(request.body);
        const result = await crearTransferencia(request.idDueno, input);
        await registrarAuditoria({
            tipoActor: "dueno",
            idActor: request.idDueno,
            idMascota: input.idMascota,
            accion: "crear_transferencia",
            ip: request.ip,
        });
        reply.code(201);
        return result;
    });
    app.post("/transfers/redeem", { preHandler: exigirDueno }, async (request) => {
        const input = esquemaCanjeTransferencia.parse(request.body);
        const transferencia = await canjearTransferencia(request.idDueno, input);
        await registrarAuditoria({
            tipoActor: "dueno",
            idActor: request.idDueno,
            idMascota: transferencia.idMascota,
            accion: "canjear_transferencia",
            ip: request.ip,
        });
        return transferencia;
    });
    app.post("/transfers/:idTransferencia/cancel", { preHandler: exigirDueno }, async (request) => {
        const { idTransferencia } = esquemaParametrosTransferencia.parse(request.params);
        const transferencia = await cancelarTransferencia(request.idDueno, idTransferencia);
        await registrarAuditoria({
            tipoActor: "dueno",
            idActor: request.idDueno,
            idMascota: transferencia.idMascota,
            accion: "cancelar_transferencia",
            ip: request.ip,
        });
        return transferencia;
    });
}
