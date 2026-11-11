import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
    esquemaCreacionCamada,
    esquemaCreacionDueno,
    esquemaCreacionEventoSalud,
    esquemaCreacionEventoSaludVeterinario,
    esquemaCreacionMascota,
    esquemaCreacionVeterinario,
    esquemaSolicitudContactoPublico,
    esquemaSolicitudAccesoVeterinarioMascota,
} from "../index.js";

const dueno = { tipoDocumento: "DNI", numeroDocumento: "45678912", nombres: "María José", apellidos: "Quispe Torres", correo: "maria@example.com", contrasena: "Clave-Segura-2026!", telefono: "944 556 677", aceptaTratamientoDatos: true };
const ok = (esquema, datos) => esquema.safeParse(datos).success;

describe("documento de identidad según su tipo", () => {
    it("el DNI son exactamente 8 dígitos", () => {
        expect(ok(esquemaCreacionDueno, dueno)).toBe(true);
        for (const numeroDocumento of ["1234567", "123456789", "1234567a", "abcdefgh", "12 34 56", "' OR 1=1--", "1".repeat(1000)]) {
            expect(ok(esquemaCreacionDueno, { ...dueno, numeroDocumento }), numeroDocumento).toBe(false);
        }
    });

    it("el carné de extranjería y el pasaporte aceptan letras y números, con su largo", () => {
        expect(ok(esquemaCreacionDueno, { ...dueno, tipoDocumento: "CE", numeroDocumento: "001234567" })).toBe(true);
        expect(ok(esquemaCreacionDueno, { ...dueno, tipoDocumento: "CE", numeroDocumento: "1234" })).toBe(false);
        expect(ok(esquemaCreacionDueno, { ...dueno, tipoDocumento: "PASAPORTE", numeroDocumento: "ab123456" })).toBe(true);
        expect(ok(esquemaCreacionDueno, { ...dueno, tipoDocumento: "PASAPORTE", numeroDocumento: "A1" })).toBe(false);
    });

    it("un tipo de documento inventado se rechaza", () => {
        expect(ok(esquemaCreacionDueno, { ...dueno, tipoDocumento: "LICENCIA" })).toBe(false);
    });
});

describe("datos de la persona", () => {
    it("los nombres son letras: sin números, símbolos ni longitudes absurdas", () => {
        for (const nombres of ["A", "Ana123", "<b>Ana</b>", "Ana; DROP TABLE", "A".repeat(500), "   "]) {
            expect(ok(esquemaCreacionDueno, { ...dueno, nombres }), nombres).toBe(false);
        }
        expect(ok(esquemaCreacionDueno, { ...dueno, nombres: "  José   Ángel  ", apellidos: "O'Brien-Núñez" })).toBe(true);
    });

    it("el teléfono son dígitos (7 a 15) y un celular peruano empieza con 9", () => {
        for (const telefono of ["abc", "12345", "1".repeat(30), "944-55", "844556677", "+51 844556677"]) {
            expect(ok(esquemaCreacionDueno, { ...dueno, telefono }), telefono).toBe(false);
        }
        for (const telefono of ["944556677", "+51 944-556-677", "+14155550123", ""]) {
            expect(ok(esquemaCreacionDueno, { ...dueno, telefono }), telefono).toBe(true);
        }
    });

    it("el correo del alta pasa por la misma regla estricta que el login", () => {
        expect(ok(esquemaCreacionDueno, { ...dueno, correo: "' OR 1=1 --@x.co" })).toBe(false);
        expect(ok(esquemaCreacionDueno, { ...dueno, correo: `${"a".repeat(250)}@x.co` })).toBe(false);
    });
});

describe("mascota", () => {
    const mascota = { nombre: "Luna", especie: "Perro", raza: "Mestizo", sexo: "Hembra", fechaNacimientoAprox: "2021-03-15" };

    it("acepta una mascota real y la normaliza", () => {
        const datos = esquemaCreacionMascota.parse(mascota);
        expect(datos).toMatchObject({ nombre: "Luna", especie: "perro", raza: "mestizo", sexo: "hembra" });
    });

    it("rechaza especie, raza o sexo con basura y nombres con código", () => {
        expect(ok(esquemaCreacionMascota, { ...mascota, especie: "perro123" })).toBe(false);
        expect(ok(esquemaCreacionMascota, { ...mascota, raza: "x".repeat(200) })).toBe(false);
        expect(ok(esquemaCreacionMascota, { ...mascota, sexo: "otro" })).toBe(false);
        expect(ok(esquemaCreacionMascota, { ...mascota, nombre: "<script>alert(1)</script>" })).toBe(false);
        expect(ok(esquemaCreacionMascota, { ...mascota, nombre: "L".repeat(1000) })).toBe(false);
    });

    it("la fecha de nacimiento no puede ser futura ni de hace décadas imposibles", () => {
        const manana = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
        expect(ok(esquemaCreacionMascota, { ...mascota, fechaNacimientoAprox: manana })).toBe(false);
        expect(ok(esquemaCreacionMascota, { ...mascota, fechaNacimientoAprox: "1950-01-01" })).toBe(false);
        // Un año tecleado a medias o inventado (1222) no es una fecha de vida de mascota: tope de 30 años.
        expect(ok(esquemaCreacionMascota, { ...mascota, fechaNacimientoAprox: "1222-09-08" })).toBe(false);
        expect(ok(esquemaCreacionEventoSalud, { idMascota: randomUUID(), tipo: "vacuna", textoOriginal: "Vacuna séxtuple", claveIdempotencia: randomUUID(), fechaEvento: "1222-09-08" })).toBe(false);
        expect(ok(esquemaCreacionMascota, { ...mascota, fechaNacimientoAprox: "2021-02-30" })).toBe(false);
        expect(ok(esquemaCreacionMascota, { ...mascota, raza: "", sexo: "", fechaNacimientoAprox: "" })).toBe(true);
    });

    it("la camada aplica las mismas reglas a cada cría", () => {
        expect(ok(esquemaCreacionCamada, { mascotas: [mascota, { ...mascota, nombre: "<x>" }] })).toBe(false);
    });
});

describe("evento de salud", () => {
    const evento = { idMascota: randomUUID(), tipo: "vacuna", fechaEvento: "2026-01-10", textoOriginal: "Vacuna séxtuple", claveIdempotencia: randomUUID() };

    it("acepta un evento real", () => {
        expect(ok(esquemaCreacionEventoSalud, { ...evento, nombreProfesional: "Dra. Rojas" })).toBe(true);
    });

    it("rechaza fechas futuras, textos enormes, etiquetas y profesionales con dígitos", () => {
        const manana = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
        expect(ok(esquemaCreacionEventoSalud, { ...evento, fechaEvento: manana })).toBe(false);
        expect(ok(esquemaCreacionEventoSalud, { ...evento, textoOriginal: "v".repeat(1000) })).toBe(false);
        expect(ok(esquemaCreacionEventoSalud, { ...evento, textoOriginal: "<img src=x onerror=alert(1)>" })).toBe(false);
        expect(ok(esquemaCreacionEventoSalud, { ...evento, textoOriginal: "x" })).toBe(false);
        expect(ok(esquemaCreacionEventoSalud, { ...evento, nombreProfesional: "Dr. 12345" })).toBe(false);
    });
});

describe("veterinario", () => {
    const vet = { pais: "pe", autoridadEmisora: "CMVP", numeroLicencia: "cmvp-12345", identificadorFiscal: "20123456789", correo: "vet@example.com", contrasena: "Clave-Segura-2026!" };

    it("acepta una cuenta profesional y normaliza licencia y país", () => {
        const datos = esquemaCreacionVeterinario.parse(vet);
        expect(datos).toMatchObject({ pais: "PE", numeroLicencia: "CMVP-12345" });
    });

    it("rechaza licencias y autoridades con basura o largos absurdos", () => {
        expect(ok(esquemaCreacionVeterinario, { ...vet, numeroLicencia: "12" })).toBe(false);
        expect(ok(esquemaCreacionVeterinario, { ...vet, numeroLicencia: "1'; DROP--" })).toBe(false);
        expect(ok(esquemaCreacionVeterinario, { ...vet, autoridadEmisora: "C".repeat(500) })).toBe(false);
        expect(ok(esquemaCreacionVeterinario, { ...vet, identificadorFiscal: "123" })).toBe(false);
        expect(ok(esquemaCreacionVeterinario, { ...vet, identificadorFiscal: "2012345678" })).toBe(false);
    });
});

describe("contacto público y QR", () => {
    const contacto = { tokenQr: "AbCdEfGhIjKlMnOpQrStUv", nombreContacto: "Pedro Ruiz", canalContacto: "pedro@example.com", mensaje: "Encontré a tu mascota en el parque." };

    it("acepta un contacto con correo o con teléfono", () => {
        expect(ok(esquemaSolicitudContactoPublico, contacto)).toBe(true);
        expect(ok(esquemaSolicitudContactoPublico, { ...contacto, canalContacto: "944 556 677" })).toBe(true);
    });

    it("rechaza canales que no son contacto y mensajes de más de 500 caracteres", () => {
        expect(ok(esquemaSolicitudContactoPublico, { ...contacto, canalContacto: "llámame mañana" })).toBe(false);
        expect(ok(esquemaSolicitudContactoPublico, { ...contacto, mensaje: "m".repeat(301) })).toBe(false);
        expect(ok(esquemaSolicitudContactoPublico, { ...contacto, mensaje: "<script>x</script>" })).toBe(false);
        expect(ok(esquemaSolicitudContactoPublico, { ...contacto, nombreContacto: "P3dro" })).toBe(false);
    });

    it("el token QR solo tiene el alfabeto base64url y un largo acotado", () => {
        expect(ok(esquemaSolicitudAccesoVeterinarioMascota, { tokenQr: "AbCdEfGhIjKlMnOpQrStUv" })).toBe(true);
        for (const tokenQr of ["", "a b", "x'; DROP", "<x>", "a".repeat(65)]) {
            expect(ok(esquemaSolicitudAccesoVeterinarioMascota, { tokenQr }), tokenQr).toBe(false);
        }
    });
});

describe("atención del veterinario: solo de hoy o de la última semana", () => {
    const dia = (dias) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
    const atencion = (fechaEvento) => ({ tipo: "vacuna", fechaEvento, textoOriginal: "Antirrábica", claveIdempotencia: randomUUID() });

    it("acepta hoy y hasta 7 días atrás", () => {
        for (const dias of [0, 1, 7]) {
            expect(ok(esquemaCreacionEventoSaludVeterinario, atencion(dia(dias)))).toBe(true);
        }
    });

    it("rechaza lo antiguo, lo futuro y los años inventados; el dueño sí puede declarar hasta 30 años atrás", () => {
        for (const fecha of [dia(10), dia(270), "1222-09-08", dia(-5)]) {
            expect(ok(esquemaCreacionEventoSaludVeterinario, atencion(fecha))).toBe(false);
        }
        expect(ok(esquemaCreacionEventoSalud, { ...atencion(dia(270)), idMascota: randomUUID() })).toBe(true);
    });
});
