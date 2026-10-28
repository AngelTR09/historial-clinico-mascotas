import { z } from "zod";
import { TIPOS_DOCUMENTO } from "../constants.js";
import { esquemaContrasena, esquemaId, esquemaFechaHoraIso, esquemaTextoNoVacio, textoOpcional } from "./primitives.js";
export const tipoDocumentoSchema = z.enum(TIPOS_DOCUMENTO);
/**
 * Representación de dominio de un dueño. `docNumberEnc` no aparece aquí:
 * es un blob cifrado sin utilidad fuera del backend (RN 4). Solo `hmacDocumento`
 * viaja como referencia opaca de indexación cuando hace falta.
 */
export const esquemaDueno = z.object({
    id: esquemaId,
    tipoDocumento: tipoDocumentoSchema,
    hmacDocumento: z.string(),
    nombres: esquemaTextoNoVacio,
    apellidos: esquemaTextoNoVacio,
    correo: z.string().email(),
    creadoEn: esquemaFechaHoraIso,
    fechaConsentimiento: esquemaFechaHoraIso,
});
/** Lo que el propio dueño ve de su cuenta, autenticado. */
export const esquemaPerfilDueno = esquemaDueno
    .omit({ hmacDocumento: true })
    .extend({ telefono: z.string().min(6).nullable() });
/**
 * Alta de cuenta (RF 01). `numeroDocumento` y `telefono` viajan en claro solo en
 * esta solicitud; el backend los cifra/hashea antes de persistir y nunca los
 * vuelve a devolver así. `aceptaTratamientoDatos` respalda el `fechaConsentimiento`.
 * La cuenta nace inactiva: se activa con el código de 6 dígitos que llega al correo.
 */
export const esquemaCreacionDueno = z.object({
    tipoDocumento: tipoDocumentoSchema,
    numeroDocumento: z.string().trim().min(6).max(12),
    nombres: esquemaTextoNoVacio,
    apellidos: esquemaTextoNoVacio,
    correo: z.string().trim().toLowerCase().email(),
    contrasena: esquemaContrasena,
    telefono: textoOpcional(z.string().min(6).optional()),
    aceptaTratamientoDatos: z.literal(true),
});
