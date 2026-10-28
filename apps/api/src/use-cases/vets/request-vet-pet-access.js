import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { mascotas, veterinarios } from "../../db/schema.js";
import { ErrorProhibido, ErrorNoEncontrado } from "../../domain/errors.js";
/**
 * RN 10: escanear el QR de una mascota es lo que abre el acceso de
 * validación, acotado a esa mascota y a 4 horas — no un login general.
 */
export async function solicitarAccesoVeterinarioMascota(ports, idVeterinario, tokenQr) {
    const [veterinario] = await db.select({ estado: veterinarios.estado }).from(veterinarios).where(eq(veterinarios.id, idVeterinario)).limit(1);
    if (!veterinario || veterinario.estado !== "aprobado") {
        throw new ErrorProhibido("La cuenta profesional no está aprobada");
    }
    const [mascota] = await db.select({ id: mascotas.id }).from(mascotas).where(eq(mascotas.tokenQr, tokenQr)).limit(1);
    if (!mascota) {
        throw new ErrorNoEncontrado("No existe una mascota con ese código QR");
    }
    const { token, expiraEn } = await ports.autenticacion.issueVetPetAccessToken(idVeterinario, mascota.id);
    return { idMascota: mascota.id, token, expiraEn };
}
