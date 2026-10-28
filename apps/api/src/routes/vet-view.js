import { z } from "zod";
import { registrarAuditoria } from "../audit/record-audit.js";
import { fabricaExigirAccesoVeterinarioMascota } from "../plugins/auth.js";
import { obtenerVistaVeterinarioMascota } from "../use-cases/vets/get-vet-pet-view.js";
const esquemaParametros = z.object({ idMascota: z.string().uuid() });
export async function rutasVistaVeterinario(app, opts) {
    const exigirAccesoVeterinarioMascota = fabricaExigirAccesoVeterinarioMascota(opts.ports);
    // Ficha de la mascota + historial completo con su evidencia (solo lectura, RN 10). Para escribir,
    // el veterinario usa POST /pets/:idMascota/health-events (RN 3).
    app.get("/pets/:idMascota/vet-view", { preHandler: exigirAccesoVeterinarioMascota }, async (request) => {
        const { idMascota } = esquemaParametros.parse(request.params);
        const vista = await obtenerVistaVeterinarioMascota(opts.ports, idMascota);
        await registrarAuditoria({ tipoActor: "veterinario", idActor: request.idVeterinario, idMascota: idMascota, accion: "leer_vista_veterinario_mascota", ip: request.ip });
        return vista;
    });
}
