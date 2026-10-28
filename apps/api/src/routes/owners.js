import { esquemaCreacionDueno } from "@hcm/shared";
import { db } from "../db/client.js";
import { duenos } from "../db/schema.js";
import { fabricaExigirDueno } from "../plugins/auth.js";
import { registrarDueno } from "../use-cases/accounts/register-owner.js";
import { eq } from "drizzle-orm";
export async function rutasDuenos(app, opts) {
    const exigirDueno = fabricaExigirDueno(opts.ports);
    app.post("/owners", async (request, reply) => {
        const input = esquemaCreacionDueno.parse(request.body);
        const result = await registrarDueno(opts.ports, input);
        reply.code(201);
        return result;
    });
    app.get("/owners/me", { preHandler: exigirDueno }, async (request) => {
        const [dueno] = await db
            .select({
            id: duenos.id,
            tipoDocumento: duenos.tipoDocumento,
            nombres: duenos.nombres,
            apellidos: duenos.apellidos,
            email: duenos.correo,
            creadoEn: duenos.creadoEn,
        })
            .from(duenos)
            .where(eq(duenos.id, request.idDueno))
            .limit(1);
        return dueno;
    });
}
