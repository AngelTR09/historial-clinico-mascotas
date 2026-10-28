import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
    ANIOS_RETENCION_AUDITORIA,
    HORAS_EXPIRACION_ACCESO_VALIDADOR,
    esquemaCanjeTransferencia,
    esquemaContrasena,
    esquemaCreacionDueno,
    esquemaInicioSesion,
    esquemaVerificacionCorreo,
    esquemaCreacionEventoSalud,
    textoSinDatosPersonales,
} from "../index.js";

const eventoValido = () => ({
    idMascota: randomUUID(),
    tipo: "vacuna",
    fechaEvento: "2025-02-10",
    textoOriginal: "Sextuple",
    claveIdempotencia: randomUUID(),
});

describe("esquemaCreacionEventoSalud (RF 04, RN 6)", () => {
    it("acepta un evento mínimo válido", () => {
        expect(esquemaCreacionEventoSalud.safeParse(eventoValido()).success).toBe(true);
    });

    it.each([
        ["sin clave de idempotencia", { claveIdempotencia: undefined }],
        ["clave que no es UUID", { claveIdempotencia: "123" }],
        ["tipo desconocido", { tipo: "cirugia" }],
        ["fecha mal formada", { fechaEvento: "10/02/2025" }],
        ["texto vacío o solo espacios", { textoOriginal: "   " }],
        ["mascota que no es UUID", { idMascota: "firulais" }],
    ])("rechaza %s", (_nombre, cambio) => {
        expect(esquemaCreacionEventoSalud.safeParse({ ...eventoValido(), ...cambio }).success).toBe(false);
    });

    it("RN 7: el cliente no puede fijar vacuna canónica ni nivel de confianza (se descartan)", () => {
        const resultado = esquemaCreacionEventoSalud.parse({ ...eventoValido(), vacunaCanonicaId: randomUUID(), nivelConfianza: "verificado" });
        expect(resultado).not.toHaveProperty("vacunaCanonicaId");
        expect(resultado).not.toHaveProperty("nivelConfianza");
    });

    it("regresión (60c60ba): un profesional en blanco cuenta como ausente, no como inválido", () => {
        const resultado = esquemaCreacionEventoSalud.safeParse({ ...eventoValido(), nombreProfesional: "" });
        expect(resultado.success).toBe(true);
        expect(resultado.data.nombreProfesional).toBeUndefined();
    });
});

describe("esquemaCreacionDueno (RF 01)", () => {
    const dueno = () => ({ tipoDocumento: "DNI", numeroDocumento: "12345678", nombres: "Ana", apellidos: "Lopez", correo: "ana@example.com", contrasena: "Clave-Segura-2026!", aceptaTratamientoDatos: true });

    it("acepta un alta válida, con teléfono en blanco", () => {
        expect(esquemaCreacionDueno.safeParse({ ...dueno(), telefono: "" }).success).toBe(true);
    });

    it("exige el consentimiento explícito (Ley 29733)", () => {
        expect(esquemaCreacionDueno.safeParse({ ...dueno(), aceptaTratamientoDatos: false }).success).toBe(false);
        expect(esquemaCreacionDueno.safeParse({ ...dueno(), aceptaTratamientoDatos: undefined }).success).toBe(false);
    });

    it.each([
        ["correo inválido", { correo: "ana" }],
        ["documento demasiado corto", { numeroDocumento: "123" }],
        ["tipo de documento desconocido", { tipoDocumento: "LICENCIA" }],
    ])("rechaza %s", (_nombre, cambio) => {
        expect(esquemaCreacionDueno.safeParse({ ...dueno(), ...cambio }).success).toBe(false);
    });
});

describe("esquemaContrasena: la misma política que Cognito (RNF 03)", () => {
    it("acepta 12 caracteres con minúscula, mayúscula, número y símbolo", () => {
        expect(esquemaContrasena.safeParse("Clave-Segura-2026!").success).toBe(true);
    });

    it.each([
        ["menos de 12 caracteres", "Corta-1!aB"],
        ["sin minúscula", "CLAVE-SEGURA-2026!"],
        ["sin mayúscula", "clave-segura-2026!"],
        ["sin número", "Clave-Segura-Larga!"],
        ["sin símbolo", "ClaveSegura2026ab"],
        ["más de 128 caracteres", `Aa1!${"x".repeat(130)}`],
    ])("rechaza %s", (_nombre, contrasena) => {
        expect(esquemaContrasena.safeParse(contrasena).success).toBe(false);
    });

    it("el alta normaliza el correo a minúsculas y exige contraseña", () => {
        const base = { tipoDocumento: "DNI", numeroDocumento: "12345678", nombres: "Ana", apellidos: "Lopez", aceptaTratamientoDatos: true };
        expect(esquemaCreacionDueno.parse({ ...base, correo: " ANA@Example.com ", contrasena: "Clave-Segura-2026!" }).correo).toBe("ana@example.com");
        expect(esquemaCreacionDueno.safeParse({ ...base, correo: "ana@example.com" }).success).toBe(false);
    });
});

describe("esquemas de sesión", () => {
    it("la contraseña es opcional al verificar el correo (solo el reclamo de cuenta la usa)", () => {
        const base = { rol: "dueno", correo: "ana@example.com", codigo: "123456" };
        expect(esquemaVerificacionCorreo.safeParse(base).success).toBe(true);
        expect(esquemaVerificacionCorreo.safeParse({ ...base, contrasena: "Clave-Segura-2026!" }).success).toBe(true);
        expect(esquemaVerificacionCorreo.safeParse({ ...base, contrasena: "" }).success).toBe(false);
    });

    it("el código de verificación son exactamente 6 dígitos", () => {
        const base = { rol: "dueno", correo: "ana@example.com" };
        expect(esquemaVerificacionCorreo.safeParse({ ...base, codigo: "123456" }).success).toBe(true);
        for (const codigo of ["12345", "1234567", "12345a", "      "]) {
            expect(esquemaVerificacionCorreo.safeParse({ ...base, codigo }).success, codigo).toBe(false);
        }
    });

    it("el rol solo puede ser dueno o veterinario y el inicio de sesión no valida la política (solo compara)", () => {
        expect(esquemaInicioSesion.safeParse({ rol: "admin", correo: "a@b.co", contrasena: "x" }).success).toBe(false);
        expect(esquemaInicioSesion.safeParse({ rol: "veterinario", correo: "a@b.co", contrasena: "x" }).success).toBe(true);
    });
});

describe("esquemaCanjeTransferencia", () => {
    it("exige id UUID y un código de al menos 6 caracteres", () => {
        expect(esquemaCanjeTransferencia.safeParse({ idTransferencia: randomUUID(), codigo: "ABC123" }).success).toBe(true);
        expect(esquemaCanjeTransferencia.safeParse({ idTransferencia: randomUUID(), codigo: "abc" }).success).toBe(false);
        expect(esquemaCanjeTransferencia.safeParse({ idTransferencia: "x", codigo: "ABC123" }).success).toBe(false);
    });
});

describe("RN 5: textos libres de la ficha pública", () => {
    it.each(["llámame al 999 888 777", "999-888-777", "(044) 123 456", "dueno@correo.com", "9998887776"])("rechaza %j", (texto) => {
        expect(textoSinDatosPersonales(texto)).toBe(false);
    });

    it.each(["collar rojo con una mancha blanca", "nació en 2019", "tiene 3 años y 2 meses"])("acepta %j", (texto) => {
        expect(textoSinDatosPersonales(texto)).toBe(true);
    });
});

describe("constantes de las reglas invariantes", () => {
    it("RN 10: el acceso del validador dura 4 horas como máximo", () => {
        expect(HORAS_EXPIRACION_ACCESO_VALIDADOR).toBeLessThanOrEqual(4);
    });
    it("RN 9: la auditoría se retiene al menos 5 años", () => {
        expect(ANIOS_RETENCION_AUDITORIA).toBeGreaterThanOrEqual(5);
    });
});
