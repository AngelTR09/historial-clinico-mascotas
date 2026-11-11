import { z } from "zod";
import { TIPOS_DOCUMENTO } from "../constants.js";
import { esquemaCorreo, esquemaNombrePersona, esquemaNumeroDocumento, esquemaTelefono, LIMITES, validarDocumento } from "./campos.js";
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
/** Campos del alta de cuenta sin la regla cruzada documento-tipo; sirve para `extend` y `omit` antes de volver a validar. */
export const esquemaBaseCreacionDueno = z.object({
    tipoDocumento: tipoDocumentoSchema,
    // El formato depende del tipo: DNI = 8 dígitos exactos (ver `REGLAS_DOCUMENTO`).
    numeroDocumento: esquemaNumeroDocumento,
    nombres: esquemaNombrePersona(LIMITES.nombrePersona, "Los nombres"),
    apellidos: esquemaNombrePersona(LIMITES.apellidos, "Los apellidos"),
    correo: esquemaCorreo,
    contrasena: esquemaContrasena,
    telefono: textoOpcional(esquemaTelefono.optional()),
    aceptaTratamientoDatos: z.literal(true, { message: "Debes aceptar el tratamiento de datos" }),
});
export const esquemaCreacionDueno = esquemaBaseCreacionDueno.superRefine((datos, ctx) => validarDocumento(datos, ctx));
