import { and, eq, sql } from "drizzle-orm";
import { encryptSecret, hmacWithPepper } from "../../crypto/symmetric.js";
import { db } from "../../db/client.js";
import { duenos } from "../../db/schema.js";
import { esViolacionDeUnicidad } from "../../domain/db-errors.js";
import { ErrorConflicto } from "../../domain/errors.js";
import { hashContrasena } from "../../crypto/password.js";
import { emitirCodigoVerificacion } from "./account-auth.js";
/**
 * RF 01. El documento se toma como lo declara el dueño: no se contrasta
 * con ningún servicio externo. Solo se cifra en la columna y se indexa por
 * su HMAC (RN 4), lo que además impide dos cuentas con el mismo documento.
 *
 * La cuenta nace inactiva y NO entrega sesión: queda a la espera del código de 6
 * dígitos que llega al correo (`POST /auth/verify`). El correo es el nombre de usuario.
 */
export async function registrarDueno(ports, input) {
    const hmacDocumento = hmacWithPepper(input.numeroDocumento);
    const [existente] = await db
        .select({ id: duenos.id, correo: duenos.correo, contrasenaHash: duenos.contrasenaHash })
        .from(duenos)
        .where(eq(duenos.hmacDocumento, hmacDocumento))
        .limit(1);
    if (existente) {
        // Un veterinario pudo haber registrado a este dueño sin contraseña: la cuenta se reclama
        // con el mismo documento y el mismo correo que dejó el veterinario. El código de 6 dígitos
        // va a ESE correo, así que solo quien tiene el buzón puede activarla.
        if (!existente.contrasenaHash && existente.correo.toLowerCase() === input.correo.toLowerCase()) {
            return reclamarCuentaSinActivar(ports, existente, input);
        }
        throw new ErrorConflicto("Ya existe una cuenta registrada con este documento");
    }
    const [correoEnUso] = await db.select({ id: duenos.id }).from(duenos).where(and(sql `lower(${duenos.correo}) = ${input.correo.toLowerCase()}`, sql `${duenos.contrasenaHash} IS NOT NULL`)).limit(1);
    if (correoEnUso) {
        throw new ErrorConflicto("Ya existe una cuenta con este correo");
    }
    const contrasenaHash = await hashContrasena(input.contrasena);
    let insertado;
    try {
        [insertado] = await db
        .insert(duenos)
        .values({
        tipoDocumento: input.tipoDocumento,
        numeroDocumentoCifrado: encryptSecret(input.numeroDocumento),
        hmacDocumento,
        nombres: input.nombres,
        apellidos: input.apellidos,
        correo: input.correo,
        telefonoCifrado: input.telefono ? encryptSecret(input.telefono) : null,
        fechaConsentimiento: new Date(),
        contrasenaHash,
    })
        .returning({ id: duenos.id });
    }
    catch (error) {
        // Otro alta con el mismo correo ganó la carrera entre la consulta y el INSERT.
        if (esViolacionDeUnicidad(error)) {
            throw new ErrorConflicto("Ya existe una cuenta con este correo");
        }
        throw error;
    }
    if (!insertado) {
        throw new Error("No se pudo crear el dueño");
    }
    await emitirCodigoVerificacion(ports, "dueno", { id: insertado.id, correo: input.correo });
    return { idDueno: insertado.id, requiereVerificacion: true };
}

/** Fija la contraseña de una cuenta creada por un veterinario y emite el código para activarla. */
async function reclamarCuentaSinActivar(ports, existente, input) {
    const [correoEnUso] = await db.select({ id: duenos.id }).from(duenos).where(and(sql `lower(${duenos.correo}) = ${input.correo.toLowerCase()}`, sql `${duenos.contrasenaHash} IS NOT NULL`)).limit(1);
    if (correoEnUso) {
        throw new ErrorConflicto("Ya existe una cuenta con este correo");
    }
    await db
        .update(duenos)
        .set({ contrasenaHash: await hashContrasena(input.contrasena), fechaConsentimiento: new Date() })
        .where(eq(duenos.id, existente.id));
    await emitirCodigoVerificacion(ports, "dueno", { id: existente.id, correo: existente.correo });
    return { idDueno: existente.id, requiereVerificacion: true };
}
