import { esquemaSolicitudContactoPublico } from "@hcm/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { registrarAuditoria } from "../audit/record-audit.js";
import { db } from "../db/client.js";
import { mascotas } from "../db/schema.js";
import { ErrorNoEncontrado } from "../domain/errors.js";
import { enviarSolicitudContactoPublico } from "../use-cases/public/submit-public-contact-request.js";
const esquemaParametros = z.object({ tokenQr: z.string().min(1) });
/**
 * RF 21. Sin autenticación: es la ficha que ve cualquiera que escanea la
 * placa. Nunca expone `public_code`, `owner_id` ni datos del dueño
 * (RN 1, RN 5) porque `PuertoLecturaPublica` ya proyecta solo lo permitido. El
 * `idMascota` real solo se resuelve aparte, para RN 9, y nunca viaja en la
 * respuesta.
 */
export async function rutasPublicas(app, opts) {
    app.get("/public/pets/:tokenQr", async (request) => {
        const { tokenQr } = esquemaParametros.parse(request.params);
        const perfil = await opts.ports.lecturaPublica.getPetProfileByQrToken(tokenQr);
        if (!perfil) {
            throw new ErrorNoEncontrado("No existe una mascota con ese código QR");
        }
        const [mascota] = await db.select({ id: mascotas.id }).from(mascotas).where(eq(mascotas.tokenQr, tokenQr)).limit(1);
        await registrarAuditoria({ tipoActor: "sistema", idActor: null, idMascota: mascota?.id ?? null, accion: "leer_ficha_publica", ip: request.ip });
        return perfil;
    });
    app.post("/public/contact", async (request, reply) => {
        const input = esquemaSolicitudContactoPublico.parse(request.body);
        const { idMascota } = await enviarSolicitudContactoPublico(opts.ports, input);
        await registrarAuditoria({ tipoActor: "sistema", idActor: null, idMascota: idMascota, accion: "enviar_contacto_publico", ip: request.ip });
        reply.code(202);
        return { received: true };
    });
}
