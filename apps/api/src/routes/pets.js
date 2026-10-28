import { esquemaConfirmacionFoto, esquemaSolicitudSubidaFoto, esquemaCargaMasivaMascotas, esquemaCreacionCamada, esquemaCreacionMascota, esquemaActualizacionEstadoMascota, esquemaActualizacionMascota } from "@hcm/shared";
import { z } from "zod";
import { registrarAuditoria } from "../audit/record-audit.js";
import { fabricaExigirDueno } from "../plugins/auth.js";
import { encolarCargaMasivaMascotas } from "../use-cases/pets/enqueue-bulk-pet-upload.js";
import { listarMascotasDueno } from "../use-cases/pets/list-owner-pets.js";
import { registrarCamada } from "../use-cases/pets/register-litter.js";
import { registrarMascota } from "../use-cases/pets/register-pet.js";
import { actualizarMascota } from "../use-cases/pets/update-pet.js";
import { confirmarFotoMascota, solicitarUrlSubidaFotoMascota } from "../use-cases/pets/update-pet-photo.js";
import { actualizarEstadoMascota } from "../use-cases/pets/update-pet-status.js";
const esquemaParametrosEstado = z.object({ idMascota: z.string().uuid() });
const ACCION_AUDITORIA_POR_ESTADO = {
    activa: "marcar_mascota_recuperada",
    extraviada: "marcar_mascota_extraviada",
    fallecida: "marcar_mascota_fallecida",
};
export async function rutasMascotas(app, opts) {
    const exigirDueno = fabricaExigirDueno(opts.ports);
    app.post("/pets", { preHandler: exigirDueno }, async (request, reply) => {
        const input = esquemaCreacionMascota.parse(request.body);
        const mascota = await registrarMascota(opts.ports, request.idDueno, input);
        await registrarAuditoria({ tipoActor: "dueno", idActor: request.idDueno, idMascota: mascota.id, accion: "crear_mascota", ip: request.ip });
        reply.code(201);
        return mascota;
    });
    app.post("/pets/litter", { preHandler: exigirDueno }, async (request, reply) => {
        const input = esquemaCreacionCamada.parse(request.body);
        const camada = await registrarCamada(opts.ports, request.idDueno, input.mascotas);
        for (const mascota of camada) {
            await registrarAuditoria({ tipoActor: "dueno", idActor: request.idDueno, idMascota: mascota.id, accion: "crear_mascota", ip: request.ip });
        }
        reply.code(201);
        return camada;
    });
    app.post("/pets/bulk", { preHandler: exigirDueno }, async (request, reply) => {
        const input = esquemaCargaMasivaMascotas.parse(request.body);
        const result = await encolarCargaMasivaMascotas(opts.ports, request.idDueno, input);
        await registrarAuditoria({ tipoActor: "dueno", idActor: request.idDueno, idMascota: null, accion: "encolar_carga_masiva", ip: request.ip });
        reply.code(202);
        return result;
    });
    app.get("/pets", { preHandler: exigirDueno }, async (request) => {
        const mascotas = await listarMascotasDueno(opts.ports, request.idDueno);
        await registrarAuditoria({ tipoActor: "dueno", idActor: request.idDueno, idMascota: null, accion: "listar_mascotas", ip: request.ip });
        return mascotas;
    });
    app.patch("/pets/:idMascota", { preHandler: exigirDueno }, async (request) => {
        const { idMascota } = esquemaParametrosEstado.parse(request.params);
        const input = esquemaActualizacionMascota.parse(request.body);
        const mascota = await actualizarMascota(opts.ports, request.idDueno, idMascota, input);
        await registrarAuditoria({ tipoActor: "dueno", idActor: request.idDueno, idMascota: idMascota, accion: "actualizar_mascota", ip: request.ip });
        return mascota;
    });
    app.post("/pets/:idMascota/photo/upload-url", { preHandler: exigirDueno }, async (request) => {
        const { idMascota } = esquemaParametrosEstado.parse(request.params);
        const { mime } = esquemaSolicitudSubidaFoto.parse(request.body);
        const result = await solicitarUrlSubidaFotoMascota(opts.ports, request.idDueno, idMascota, mime);
        await registrarAuditoria({ tipoActor: "dueno", idActor: request.idDueno, idMascota, accion: "solicitar_url_subida_foto", ip: request.ip });
        return result;
    });
    app.put("/pets/:idMascota/photo", { preHandler: exigirDueno }, async (request) => {
        const { idMascota } = esquemaParametrosEstado.parse(request.params);
        const { clave } = esquemaConfirmacionFoto.parse(request.body);
        const mascota = await confirmarFotoMascota(opts.ports, request.idDueno, idMascota, clave);
        await registrarAuditoria({ tipoActor: "dueno", idActor: request.idDueno, idMascota, accion: "actualizar_foto_mascota", ip: request.ip });
        return mascota;
    });
    app.patch("/pets/:idMascota/status", { preHandler: exigirDueno }, async (request) => {
        const { idMascota } = esquemaParametrosEstado.parse(request.params);
        const input = esquemaActualizacionEstadoMascota.parse(request.body);
        const mascota = await actualizarEstadoMascota(opts.ports, request.idDueno, idMascota, input);
        await registrarAuditoria({
            tipoActor: "dueno",
            idActor: request.idDueno,
            idMascota: idMascota,
            accion: ACCION_AUDITORIA_POR_ESTADO[input.estado],
            ip: request.ip,
        });
        return mascota;
    });
}
