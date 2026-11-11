import { LIMITES, REGLAS_DOCUMENTO } from "@hcm/shared";

/**
 * Propiedades de un <input> según lo que significa el dato: largo máximo, teclado móvil y filtro de lo
 * que se escribe (un DNI no admite letras, un nombre no admite dígitos). La validación real sigue
 * siendo la del esquema compartido, que también corre en la API; esto solo evita que se escriba
 * basura y que alguien pegue mil caracteres.
 */
const LETRAS = /[^\p{L}\s'.-]/gu;
const LETRAS_Y_NUMEROS = /[^\p{L}\p{N}\s'.-]/gu;
const PALABRAS = /[^\p{L}\s-]/gu;

const filtrar = (patron) => (valor) => valor.replace(patron, "");

const TIPOS = {
    correo: { maxLength: LIMITES.correo, inputMode: "email", autoCapitalize: "none", spellCheck: false, filtro: (v) => v.replace(/\s/g, "") },
    nombrePersona: { maxLength: LIMITES.nombrePersona, autoComplete: "given-name", filtro: filtrar(LETRAS) },
    apellidos: { maxLength: LIMITES.apellidos, autoComplete: "family-name", filtro: filtrar(LETRAS) },
    telefono: { maxLength: LIMITES.telefono, inputMode: "tel", autoComplete: "tel", filtro: filtrar(/[^\d+\s()-]/g) },
    nombreMascota: { maxLength: LIMITES.nombreMascota, filtro: filtrar(LETRAS_Y_NUMEROS) },
    especie: { maxLength: LIMITES.especie, filtro: filtrar(PALABRAS) },
    raza: { maxLength: LIMITES.raza, filtro: filtrar(PALABRAS) },
    textoEvento: { maxLength: LIMITES.textoEvento, filtro: filtrar(/[<>]/g) },
    profesional: { maxLength: LIMITES.nombreProfesional, filtro: filtrar(LETRAS) },
    autoridad: { maxLength: LIMITES.autoridadEmisora, filtro: filtrar(/[<>]/g) },
    licencia: { maxLength: LIMITES.numeroLicencia, autoCapitalize: "characters", spellCheck: false, filtro: filtrar(/[^A-Za-z0-9./-]/g) },
    fiscal: { maxLength: LIMITES.identificadorFiscal, inputMode: "numeric", spellCheck: false, filtro: filtrar(/[^A-Za-z0-9\s-]/g) },
    nombreContacto: { maxLength: LIMITES.nombreContacto, filtro: filtrar(LETRAS) },
    canalContacto: { maxLength: LIMITES.canalContacto, autoCapitalize: "none", spellCheck: false, filtro: filtrar(/\s{2,}/g) },
    mensaje: { maxLength: LIMITES.mensajeContacto, filtro: filtrar(/[<>]/g) },
    // El QR llega como código suelto o como la URL completa de la placa; la API valida el token ya extraído.
    codigoQr: { maxLength: 300, spellCheck: false, autoCapitalize: "none", filtro: (v) => v.replace(/\s/g, "") },
    // id de transferencia (UUID) + ":" + código de 10 caracteres.
    codigoTransferencia: { maxLength: 60, spellCheck: false, autoCapitalize: "characters", filtro: (v) => v.replace(/\s/g, "") },
};

/** Spread para un <input>/<textarea>: `<input {...register("nombre")} {...entrada("nombrePersona")}/>`. */
export function entrada(tipo) {
    const { filtro, ...propiedades } = TIPOS[tipo];
    return {
        ...propiedades,
        onInput: (evento) => {
            const limpio = filtro(evento.target.value);
            if (limpio !== evento.target.value) {
                evento.target.value = limpio;
            }
        },
    };
}

/** Número de documento: 8 dígitos para el DNI; letras y números (hasta 12) para CE y pasaporte. */
export function entradaDocumento(tipoDocumento) {
    const regla = REGLAS_DOCUMENTO[tipoDocumento] ?? REGLAS_DOCUMENTO.DNI;
    return {
        maxLength: regla.maximo,
        inputMode: regla.soloDigitos ? "numeric" : "text",
        autoComplete: "off",
        spellCheck: false,
        onInput: (evento) => {
            const limpio = regla.soloDigitos ? evento.target.value.replace(/\D/g, "") : evento.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
            if (limpio !== evento.target.value) {
                evento.target.value = limpio;
            }
        },
    };
}

export const ETIQUETA_DOCUMENTO = { DNI: "DNI", CE: "Carné de extranjería", PASAPORTE: "Pasaporte" };
export const AYUDA_DOCUMENTO = { DNI: "8 dígitos", CE: "9 a 12 letras o números", PASAPORTE: "6 a 12 letras o números" };
