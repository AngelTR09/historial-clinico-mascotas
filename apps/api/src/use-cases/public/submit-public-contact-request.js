import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { duenos, mascotas } from "../../db/schema.js";
import { ErrorNoEncontrado } from "../../domain/errors.js";
/**
 * RN 5: el canal público nunca expone datos personales del dueño. Quien
 * encuentra a la mascota nunca ve el correo/teléfono real — el mensaje se
 * enruta por `PuertoNotificacion` (SNS en la nube, consola en local) y el dueño es
 * quien decide si responde, por el canal que el hallador sí puso en el
 * formulario.
 */
export async function enviarSolicitudContactoPublico(ports, input) {
    const [mascota] = await db.select({ id: mascotas.id, nombre: mascotas.nombre, idDueno: mascotas.idDueno }).from(mascotas).where(eq(mascotas.tokenQr, input.tokenQr)).limit(1);
    if (!mascota) {
        throw new ErrorNoEncontrado("No existe una mascota con ese código QR");
    }
    const [dueno] = await db.select({ correo: duenos.correo }).from(duenos).where(eq(duenos.id, mascota.idDueno)).limit(1);
    if (!dueno) {
        throw new ErrorNoEncontrado("El dueño de esta mascota ya no existe");
    }
    await ports.notificacion.notify({
        to: dueno.correo,
        template: "contacto_mascota_perdida",
        data: {
            nombreMascota: mascota.nombre,
            nombreContacto: input.nombreContacto,
            canalContacto: input.canalContacto,
            mensaje: input.mensaje,
        },
    });
    return { idMascota: mascota.id };
}
