import { and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hashContrasena } from "../../crypto/password.js";
import { db } from "../../db/client.js";
import { veterinarios } from "../../db/schema.js";
import { esViolacionDeUnicidad } from "../../domain/db-errors.js";
import { ErrorConflicto } from "../../domain/errors.js";
import { emitirCodigoVerificacion } from "./account-auth.js";
/**
 * RF 13 / RF 23. La licencia y el identificador fiscal son declarados, no se
 * verifican contra ningún servicio externo (no hay un registro mundial), así
 * que toda cuenta nace 'pendiente' y solo registra eventos cuando una persona
 * la aprueba (`pnpm db:aprobar-vet`). Sin ese paso, cualquiera podría escribir
 * en el expediente de cualquier mascota (RN 3, RN 10).
 *
 * Igual que el dueño, la cuenta nace inactiva y NO entrega sesión: el correo es el
 * nombre de usuario y el código de 6 dígitos que llega a él la activa (`POST /auth/verify`).
 */
export async function registrarVeterinario(ports, input) {
    const [correoEnUso] = await db.select({ id: veterinarios.id }).from(veterinarios).where(and(sql `lower(${veterinarios.correo}) = ${input.correo.toLowerCase()}`, sql `${veterinarios.contrasenaHash} IS NOT NULL`)).limit(1);
    if (correoEnUso) {
        throw new ErrorConflicto("Ya existe una cuenta con este correo");
    }
    const contrasenaHash = await hashContrasena(input.contrasena);
    let insertado;
    try {
        [insertado] = await db
            .insert(veterinarios)
            .values({
            subUsuario: randomUUID(),
            pais: input.pais,
            autoridadEmisora: input.autoridadEmisora,
            numeroLicencia: input.numeroLicencia,
            identificadorFiscal: input.identificadorFiscal ?? null,
            estado: "pendiente",
            correo: input.correo,
            contrasenaHash,
        })
            .returning();
    }
    catch (error) {
        if (esViolacionDeUnicidad(error)) {
            throw new ErrorConflicto("Ya existe una cuenta con este correo");
        }
        throw error;
    }
    if (!insertado) {
        throw new Error("No se pudo crear la cuenta profesional");
    }
    await emitirCodigoVerificacion(ports, "veterinario", { id: insertado.id, correo: input.correo });
    return {
        veterinario: {
            id: insertado.id,
            subUsuario: insertado.subUsuario,
            pais: insertado.pais,
            autoridadEmisora: insertado.autoridadEmisora,
            numeroLicencia: insertado.numeroLicencia,
            identificadorFiscal: insertado.identificadorFiscal,
            razonSocial: insertado.razonSocial,
            estado: insertado.estado,
            verificadoEn: insertado.verificadoEn ? insertado.verificadoEn.toISOString() : null,
        },
        requiereVerificacion: true,
    };
}
