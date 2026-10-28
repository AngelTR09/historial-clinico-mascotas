import { z } from "zod";
import { ESTADOS_VETERINARIO } from "../constants.js";
import { esquemaContrasena, esquemaId, esquemaFechaHoraIso, esquemaTextoNoVacio, textoOpcional } from "./primitives.js";
export const estadoVeterinarioSchema = z.enum(ESTADOS_VETERINARIO);
/** Código de país ISO 3166-1 alfa-2 ("PE", "US", "ES"): siempre en mayúsculas. */
export const esquemaPais = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Usa el código de país de 2 letras");
export const esquemaVeterinario = z.object({
    id: esquemaId,
    subUsuario: z.string(),
    pais: esquemaPais,
    autoridadEmisora: esquemaTextoNoVacio,
    numeroLicencia: esquemaTextoNoVacio,
    identificadorFiscal: esquemaTextoNoVacio.nullable(),
    razonSocial: esquemaTextoNoVacio.nullable(),
    estado: estadoVeterinarioSchema,
    verificadoEn: esquemaFechaHoraIso.nullable(),
});
/**
 * Solicitud de cuenta profesional (RF 13 / RF 23). `estado` arranca
 * siempre en 'pendiente': la licencia es declarada, no se verifica, y una
 * persona aprueba la cuenta.
 *
 * No existe un registro veterinario mundial, así que los campos son neutros
 * por país: quién emitió la licencia (`autoridadEmisora`, p. ej. "CMVP" o
 * "Texas State Board"), su número y, opcionalmente, el identificador fiscal
 * del establecimiento (RUC, EIN, NIF...). Solo se valida el formato de lo
 * que se conoce: el RUC peruano, cuando el país es PE.
 */
export const esquemaCreacionVeterinario = z
    .object({
    pais: esquemaPais,
    autoridadEmisora: esquemaTextoNoVacio,
    numeroLicencia: esquemaTextoNoVacio,
    identificadorFiscal: textoOpcional(esquemaTextoNoVacio.optional()),
    // Con el correo y la contraseña inicia sesión; la cuenta se activa con el código del correo.
    correo: z.string().trim().toLowerCase().email(),
    contrasena: esquemaContrasena,
})
    .superRefine((valor, ctx) => {
    if (valor.pais === "PE" && valor.identificadorFiscal && !/^\d{11}$/.test(valor.identificadorFiscal)) {
        ctx.addIssue({ code: "custom", path: ["identificadorFiscal"], message: "El RUC debe tener 11 dígitos" });
    }
});
/**
 * RN 10: el acceso del validador nace de escanear el QR de una mascota
 * puntual, no de un inbox global. `tokenQr` es el mismo token opaco de
 * la placa (sección 3), nunca el `codigoPublico`.
 */
export const esquemaSolicitudAccesoVeterinarioMascota = z.object({
    tokenQr: z.string().min(1),
});
