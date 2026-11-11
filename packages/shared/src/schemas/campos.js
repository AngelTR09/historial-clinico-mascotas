import { z } from "zod";

/**
 * Reglas de entrada por tipo de dato: cada campo se valida según lo que significa (un DNI son
 * 8 dígitos, un teléfono son dígitos, un nombre son letras), no solo por "no vacío". La misma regla
 * corre en la web (react-hook-form) y en la API, que es quien manda: la web solo avisa antes.
 */

/** NUL, saltos y demás caracteres de control: nunca forman parte de una contraseña ni de un texto real. */
export const tieneCaracterDeControl = (texto) => [...texto].some((caracter) => caracter.charCodeAt(0) < 32 || caracter.charCodeAt(0) === 127);
const colapsarEspacios = (valor) => (typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : valor);

/** Longitudes máximas, en un solo lugar para que la web ponga el mismo `maxLength`. */
export const LIMITES = {
    correo: 254,
    contrasena: 128,
    nombrePersona: 60,
    apellidos: 80,
    telefono: 16,
    nombreMascota: 40,
    especie: 30,
    raza: 50,
    textoEvento: 100,
    nombreProfesional: 80,
    autoridadEmisora: 80,
    numeroLicencia: 20,
    identificadorFiscal: 20,
    nombreContacto: 60,
    canalContacto: 254,
    mensajeContacto: 300,
    tokenQr: 64,
};

const PATRON_CORREO = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
export const MENSAJE_CORREO_INVALIDO = "Escribe un correo válido, por ejemplo nombre@dominio.com";

/** Correo en minúsculas, sin espacios ni caracteres que no existen en una dirección real. */
export const esquemaCorreo = z
    .string()
    .trim()
    .toLowerCase()
    .max(LIMITES.correo, MENSAJE_CORREO_INVALIDO)
    .refine((valor) => !valor.includes("..") && PATRON_CORREO.test(valor), MENSAJE_CORREO_INVALIDO);

/** Nombre de persona: letras (con tildes y ñ), espacios, apóstrofo, guion y punto. Sin dígitos ni símbolos. */
export function esquemaNombrePersona(maximo = LIMITES.nombrePersona, etiqueta = "El nombre") {
    return z.preprocess(colapsarEspacios, z
        .string()
        .min(2, `${etiqueta}: escribe al menos 2 letras`)
        .max(maximo, `${etiqueta}: máximo ${maximo} caracteres`)
        .regex(/^\p{L}[\p{L}\s'.-]*$/u, `${etiqueta}: solo se admiten letras, espacios, apóstrofo, guion y punto`));
}

/** Nombre de la mascota: letras y números (p. ej. "Rex 2"), espacios, apóstrofo, guion y punto. */
export const esquemaNombreMascota = z.preprocess(colapsarEspacios, z
    .string()
    .min(1, "Escribe el nombre de la mascota")
    .max(LIMITES.nombreMascota, `El nombre admite como máximo ${LIMITES.nombreMascota} caracteres`)
    .regex(/^[\p{L}\p{N}][\p{L}\p{N}\s'.-]*$/u, "El nombre: solo se admiten letras, números, espacios, apóstrofo, guion y punto"));

/** Palabras en minúsculas (especie, raza): solo letras, espacios y guion. */
export function esquemaPalabras(maximo, etiqueta) {
    return z.preprocess((valor) => (typeof valor === "string" ? colapsarEspacios(valor).toLowerCase() : valor), z
        .string()
        .min(2, `${etiqueta}: escribe al menos 2 letras`)
        .max(maximo, `${etiqueta}: máximo ${maximo} caracteres`)
        .regex(/^\p{L}[\p{L}\s-]*$/u, `${etiqueta}: solo se admiten letras, espacios y guion`));
}

export const SEXOS_MASCOTA = ["macho", "hembra"];
export const esquemaSexo = z.preprocess((valor) => (typeof valor === "string" ? valor.trim().toLowerCase() : valor), z.enum(SEXOS_MASCOTA, { message: "Elige macho o hembra" }));

/**
 * Número de documento según su tipo. DNI peruano: exactamente 8 dígitos. Carné de extranjería: 9 a
 * 12 caracteres alfanuméricos. Pasaporte: 6 a 12 alfanuméricos. Se guarda en mayúsculas y sin espacios.
 */
export const REGLAS_DOCUMENTO = {
    DNI: { patron: /^\d{8}$/, maximo: 8, mensaje: "El DNI debe tener exactamente 8 dígitos", soloDigitos: true },
    CE: { patron: /^[A-Z0-9]{9,12}$/, maximo: 12, mensaje: "El carné de extranjería tiene de 9 a 12 caracteres (letras y números)", soloDigitos: false },
    PASAPORTE: { patron: /^[A-Z0-9]{6,12}$/, maximo: 12, mensaje: "El pasaporte tiene de 6 a 12 caracteres (letras y números)", soloDigitos: false },
};

export function normalizarDocumento(valor) {
    return typeof valor === "string" ? valor.replace(/[\s-]/g, "").toUpperCase() : valor;
}

/** Valida `numeroDocumento` contra su `tipoDocumento` dentro de un `superRefine` del objeto que contiene ambos. */
export function validarDocumento(datos, ctx, ruta = "numeroDocumento") {
    const regla = REGLAS_DOCUMENTO[datos.tipoDocumento];
    if (regla && !regla.patron.test(datos.numeroDocumento)) {
        ctx.addIssue({ code: "custom", path: [ruta], message: regla.mensaje });
    }
}

export const esquemaNumeroDocumento = z.preprocess(normalizarDocumento, z.string().min(1, "Escribe el número de documento").max(12, "El documento admite como máximo 12 caracteres"));

/**
 * Teléfono: 7 a 15 dígitos, con `+` inicial opcional. Se aceptan espacios, guiones y paréntesis al
 * escribir y se descartan; así "+51 944-556-677" y "944556677" valen. Perú: 9 dígitos que empiezan con 9.
 */
export const esquemaTelefono = z.preprocess((valor) => (typeof valor === "string" ? valor.replace(/[\s()-]/g, "") : valor), z
    .string()
    .regex(/^\+?\d{7,15}$/, "Escribe un teléfono válido: de 7 a 15 dígitos, con + inicial si es de otro país")
    .refine((valor) => {
        // Un número peruano (9 dígitos, con o sin +51) es celular: empieza con 9.
        const nacional = /^(?:\+51)?(\d{9})$/.exec(valor)?.[1];
        return nacional === undefined || nacional.startsWith("9");
    }, "Un celular peruano tiene 9 dígitos y empieza con 9"));

/** Texto libre corto (nombre de vacuna, tratamiento): sin caracteres de control ni `<` `>`. */
export function esquemaTextoLibre(minimo, maximo, etiqueta) {
    return z.preprocess(colapsarEspacios, z
        .string()
        .min(minimo, `${etiqueta} debe tener al menos ${minimo} caracteres`)
        .max(maximo, `${etiqueta}: máximo ${maximo} caracteres`)
        .refine((valor) => !tieneCaracterDeControl(valor) && !/[<>]/.test(valor), `${etiqueta} tiene caracteres no permitidos`));
}

const DIA_EN_MS = 86_400_000;

/** Fecha ISO (AAAA-MM-DD) real: ni futura (con un día de margen por zona horaria) ni anterior a `aniosAtras` años. */
export function esquemaFechaPasada(aniosAtras, etiqueta) {
    return z
        .string()
        .date("Escribe una fecha válida")
        .refine((valor) => new Date(`${valor}T00:00:00Z`).getTime() <= Date.now() + DIA_EN_MS, `${etiqueta} no puede ser futura`)
        .refine((valor) => new Date(`${valor}T00:00:00Z`).getTime() >= Date.now() - aniosAtras * 366 * DIA_EN_MS, `${etiqueta} no puede ser de hace más de ${aniosAtras} años`);
}

/**
 * Fecha ISO (AAAA-MM-DD) de una atención que el veterinario registra: la de hoy o hasta `dias` días atrás.
 * El veterinario atestigua lo que hizo en consulta (RN 3), así que no puede registrar atenciones antiguas: eso
 * lo declara el dueño con evidencia. Como la fecha viene del navegador y el servidor cuenta en UTC, cada
 * extremo tiene un día de margen por zona horaria (la web ya limita el selector al rango exacto).
 */
export function esquemaFechaReciente(dias, etiqueta) {
    const inicioDelDiaUtc = () => Math.floor(Date.now() / DIA_EN_MS) * DIA_EN_MS;
    return z
        .string()
        .date("Escribe una fecha válida")
        .refine((valor) => new Date(`${valor}T00:00:00Z`).getTime() <= Date.now() + DIA_EN_MS, `${etiqueta} no puede ser futura`)
        .refine((valor) => new Date(`${valor}T00:00:00Z`).getTime() >= inicioDelDiaUtc() - (dias + 1) * DIA_EN_MS, `${etiqueta} no puede ser de hace más de ${dias} días`);
}

/** Token opaco del QR (16 bytes en base64url = 22 caracteres): solo ese alfabeto y un tope de largo. */
export const esquemaTokenQr = z
    .string()
    .trim()
    .min(1, "Escribe el código QR")
    .max(LIMITES.tokenQr, "El código QR es demasiado largo")
    .regex(/^[A-Za-z0-9_-]+$/, "El código QR solo tiene letras, números, guion y guion bajo");

/** Código de transferencia: 10 caracteres hexadecimales en mayúsculas. */
export const esquemaCodigoTransferencia = z.preprocess((valor) => (typeof valor === "string" ? valor.trim().toUpperCase() : valor), z.string().regex(/^[0-9A-F]{10}$/, "El código de transferencia tiene 10 caracteres (0-9 y A-F)"));
