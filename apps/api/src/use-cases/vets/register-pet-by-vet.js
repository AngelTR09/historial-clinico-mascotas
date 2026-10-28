import { eq } from "drizzle-orm";
import { encryptSecret, hmacWithPepper } from "../../crypto/symmetric.js";
import { db } from "../../db/client.js";
import { duenos, veterinarios } from "../../db/schema.js";
import { ErrorConflicto, ErrorProhibido } from "../../domain/errors.js";
import { registrarMascota } from "../pets/register-pet.js";

/**
 * El veterinario aprobado registra a la mascota (y a su dueño, si aún no existe) durante
 * la consulta, cuando el dueño no usa el sistema. Reglas:
 *  - Solo veterinarios aprobados (RN 3 y 10): sin aprobación cualquiera escribiría en expedientes.
 *  - El dueño nuevo nace sin contraseña ni correo verificado: no puede iniciar sesión hasta
 *    reclamar la cuenta (`registrarDueno` con el mismo documento y correo).
 *  - Si el documento ya tiene una cuenta activa NO se le agrega la mascota: el dueño debe
 *    mostrar su QR o registrarla él (RNF 16: nadie escribe en la cuenta de otro sin su QR).
 *  - Devuelve el acceso de 4 horas a la mascota creada, igual que si hubiera escaneado el QR.
 */
export async function registrarMascotaPorVeterinario(ports, idVeterinario, input) {
    const [veterinario] = await db.select({ estado: veterinarios.estado }).from(veterinarios).where(eq(veterinarios.id, idVeterinario)).limit(1);
    if (!veterinario || veterinario.estado !== "aprobado") {
        throw new ErrorProhibido("La cuenta profesional no está aprobada");
    }
    const datosDueno = input.dueno;
    const hmacDocumento = hmacWithPepper(datosDueno.numeroDocumento);
    const [existente] = await db.select({ id: duenos.id, contrasenaHash: duenos.contrasenaHash }).from(duenos).where(eq(duenos.hmacDocumento, hmacDocumento)).limit(1);
    if (existente?.contrasenaHash) {
        throw new ErrorConflicto("Este dueño ya tiene una cuenta: pídele que te muestre el QR de su mascota o que la registre él");
    }
    let idDueno = existente?.id;
    if (!idDueno) {
        const [creado] = await db
            .insert(duenos)
            .values({
            tipoDocumento: datosDueno.tipoDocumento,
            numeroDocumentoCifrado: encryptSecret(datosDueno.numeroDocumento),
            hmacDocumento,
            nombres: datosDueno.nombres,
            apellidos: datosDueno.apellidos,
            correo: datosDueno.correo,
            telefonoCifrado: datosDueno.telefono ? encryptSecret(datosDueno.telefono) : null,
            fechaConsentimiento: new Date(),
        })
            .returning({ id: duenos.id });
        idDueno = creado.id;
    }
    const mascota = await registrarMascota(ports, idDueno, input.mascota);
    const acceso = await ports.autenticacion.issueVetPetAccessToken(idVeterinario, mascota.id);
    return {
        idMascota: mascota.id,
        codigoPublico: mascota.codigoPublico,
        tokenQr: mascota.tokenQr,
        duenoNuevo: !existente,
        token: acceso.token,
        expiraEn: acceso.expiraEn,
    };
}
