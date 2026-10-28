import "../../env.js";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { construirPuertosLocales } from "../../container.js";
import { db } from "../../db/client.js";
import { duenos, verificacionesCorreo, veterinarios } from "../../db/schema.js";
import { ErrorConflicto, ErrorNoAutorizado, ErrorProhibido } from "../../domain/errors.js";
import { crearRastreadorFixtures, crearVeterinarioAislado, limpiarFixtures } from "../../test-support/fixtures.js";
import { iniciarSesion, reenviarCodigo, verificarCorreo } from "./account-auth.js";
import { registrarDueno } from "./register-owner.js";
import { registrarMascotaPorVeterinario } from "../vets/register-pet-by-vet.js";
import { registrarVeterinario } from "./register-vet.js";

const CONTRASENA = "Clave-Segura-2026!";
const rastreador = crearRastreadorFixtures();

/** Puertos reales de autenticación (JWT local) y una notificación que guarda lo que se envía. */
function puertos() {
    const enviados = [];
    const base = construirPuertosLocales();
    return {
        enviados,
        ports: { autenticacion: base.autenticacion, notificacion: { notify: async (n) => void enviados.push(n) } },
        ultimoCodigo: () => enviados.filter((n) => n.template === "codigo_verificacion").at(-1)?.data.codigo,
    };
}

async function nuevoDueno(ports, correo = `ana-${randomUUID()}@example.com`) {
    const resultado = await registrarDueno(ports, {
        tipoDocumento: "DNI",
        numeroDocumento: String(Math.floor(10000000 + Math.random() * 89999999)),
        nombres: "Ana",
        apellidos: "Torres",
        correo,
        contrasena: CONTRASENA,
        aceptaTratamientoDatos: true,
    });
    rastreador.ownerIds.push(resultado.idDueno);
    return { ...resultado, correo };
}

afterEach(async () => {
    await limpiarFixtures(rastreador);
});

describe("registro con código de verificación (RNF 03)", () => {
    it("no entrega sesión, envía un código de 6 dígitos y no guarda la contraseña en claro", async () => {
        const { ports, enviados, ultimoCodigo } = puertos();
        const cuenta = await nuevoDueno(ports);

        expect(cuenta).toMatchObject({ requiereVerificacion: true });
        expect(cuenta).not.toHaveProperty("token");
        expect(enviados).toHaveLength(1);
        expect(enviados[0]).toMatchObject({ to: cuenta.correo, template: "codigo_verificacion" });
        expect(ultimoCodigo()).toMatch(/^\d{6}$/);
        const [fila] = await db.select().from(duenos).where(eq(duenos.id, cuenta.idDueno));
        expect(fila.contrasenaHash).not.toContain(CONTRASENA);
        expect(fila.correoVerificadoEn).toBeNull();
    });

    it("del código solo se guarda su HMAC", async () => {
        const { ports, ultimoCodigo } = puertos();
        const cuenta = await nuevoDueno(ports);
        const filas = await db.select().from(verificacionesCorreo).where(eq(verificacionesCorreo.idDueno, cuenta.idDueno));
        expect(filas).toHaveLength(1);
        expect(filas[0].hashCodigo).not.toContain(ultimoCodigo());
    });

    it("rechaza un segundo alta con el mismo correo, sin distinguir mayúsculas", async () => {
        const { ports } = puertos();
        const cuenta = await nuevoDueno(ports, `repetido-${randomUUID()}@example.com`);
        await expect(nuevoDueno(ports, cuenta.correo.toUpperCase())).rejects.toThrow(ErrorConflicto);
    });

    it("una cuenta sin verificar no inicia sesión, y eso solo se dice con la contraseña correcta", async () => {
        const { ports } = puertos();
        const cuenta = await nuevoDueno(ports);

        await expect(iniciarSesion(ports, { rol: "dueno", correo: cuenta.correo, contrasena: CONTRASENA })).rejects.toThrow(ErrorProhibido);
        await expect(iniciarSesion(ports, { rol: "dueno", correo: cuenta.correo, contrasena: "otra-Contraseña-1!" })).rejects.toThrow("Credenciales inválidas");
    });

    it("con el código correcto activa la cuenta y entrega una sesión válida; después inicia sesión", async () => {
        const { ports, ultimoCodigo } = puertos();
        const cuenta = await nuevoDueno(ports);

        const { token } = await verificarCorreo(ports, { rol: "dueno", correo: cuenta.correo, codigo: ultimoCodigo() });
        const sesion = await iniciarSesion(ports, { rol: "dueno", correo: cuenta.correo.toUpperCase(), contrasena: CONTRASENA });

        expect(await ports.autenticacion.verifyOwnerToken(token)).toEqual({ idDueno: cuenta.idDueno });
        expect(await ports.autenticacion.verifyOwnerToken(sesion.token)).toEqual({ idDueno: cuenta.idDueno });
    });

    it("el código es de un solo uso", async () => {
        const { ports, ultimoCodigo } = puertos();
        const cuenta = await nuevoDueno(ports);
        const codigo = ultimoCodigo();
        await verificarCorreo(ports, { rol: "dueno", correo: cuenta.correo, codigo });

        await expect(verificarCorreo(ports, { rol: "dueno", correo: cuenta.correo, codigo })).rejects.toThrow("Código inválido o vencido");
    });

    it("un código vencido no sirve", async () => {
        const { ports, ultimoCodigo } = puertos();
        const cuenta = await nuevoDueno(ports);
        await db.update(verificacionesCorreo).set({ venceEn: new Date(Date.now() - 1000) }).where(eq(verificacionesCorreo.idDueno, cuenta.idDueno));

        await expect(verificarCorreo(ports, { rol: "dueno", correo: cuenta.correo, codigo: ultimoCodigo() })).rejects.toThrow(ErrorNoAutorizado);
    });

    it("tras 5 intentos fallidos el código ya no sirve ni siquiera el correcto", async () => {
        const { ports, ultimoCodigo } = puertos();
        const cuenta = await nuevoDueno(ports);
        const correcto = ultimoCodigo();
        const equivocado = correcto === "000000" ? "111111" : "000000";

        for (let i = 0; i < 5; i++) {
            await expect(verificarCorreo(ports, { rol: "dueno", correo: cuenta.correo, codigo: equivocado })).rejects.toThrow(ErrorNoAutorizado);
        }

        await expect(verificarCorreo(ports, { rol: "dueno", correo: cuenta.correo, codigo: correcto })).rejects.toThrow("Código inválido o vencido");
    });

    it("pedir otro código invalida el anterior, y no se reenvía dentro del minuto", async () => {
        const { ports, enviados, ultimoCodigo } = puertos();
        const cuenta = await nuevoDueno(ports);
        const primero = ultimoCodigo();

        await reenviarCodigo(ports, { rol: "dueno", correo: cuenta.correo });
        expect(enviados).toHaveLength(1); // dentro del minuto: no se envía otro

        await db.update(verificacionesCorreo).set({ creadoEn: new Date(Date.now() - 120_000) }).where(eq(verificacionesCorreo.idDueno, cuenta.idDueno));
        await reenviarCodigo(ports, { rol: "dueno", correo: cuenta.correo });
        expect(enviados).toHaveLength(2);
        const segundo = ultimoCodigo();

        if (segundo !== primero) {
            await expect(verificarCorreo(ports, { rol: "dueno", correo: cuenta.correo, codigo: primero })).rejects.toThrow(ErrorNoAutorizado);
        }
        await expect(verificarCorreo(ports, { rol: "dueno", correo: cuenta.correo, codigo: segundo })).resolves.toHaveProperty("token");
    });

    it("reenviar a un correo que no existe no lanza ni envía nada: no se puede enumerar cuentas", async () => {
        const { ports, enviados } = puertos();
        await expect(reenviarCodigo(ports, { rol: "dueno", correo: `nadie-${randomUUID()}@example.com` })).resolves.toBeUndefined();
        expect(enviados).toHaveLength(0);
    });
});

describe("inicio de sesión (RNF 06)", () => {
    async function cuentaActiva(ports, ultimoCodigo) {
        const cuenta = await nuevoDueno(ports);
        await verificarCorreo(ports, { rol: "dueno", correo: cuenta.correo, codigo: ultimoCodigo() });
        return cuenta;
    }

    it("correo inexistente y contraseña errónea dan exactamente el mismo error", async () => {
        const { ports, ultimoCodigo } = puertos();
        const cuenta = await cuentaActiva(ports, ultimoCodigo);

        const inexistente = await iniciarSesion(ports, { rol: "dueno", correo: `nadie-${randomUUID()}@example.com`, contrasena: CONTRASENA }).catch((e) => e);
        const erronea = await iniciarSesion(ports, { rol: "dueno", correo: cuenta.correo, contrasena: "Otra-Clave-2026!" }).catch((e) => e);

        expect(inexistente).toBeInstanceOf(ErrorNoAutorizado);
        expect(erronea).toBeInstanceOf(ErrorNoAutorizado);
        expect(inexistente.message).toBe(erronea.message);
    });

    it("cinco fallos seguidos bloquean la cuenta, y mientras dura ni la contraseña correcta entra", async () => {
        const { ports, ultimoCodigo } = puertos();
        const cuenta = await cuentaActiva(ports, ultimoCodigo);
        for (let i = 0; i < 5; i++) {
            await expect(iniciarSesion(ports, { rol: "dueno", correo: cuenta.correo, contrasena: "Mala-Clave-2026!" })).rejects.toThrow(ErrorNoAutorizado);
        }

        await expect(iniciarSesion(ports, { rol: "dueno", correo: cuenta.correo, contrasena: CONTRASENA })).rejects.toThrow(ErrorProhibido);

        await db.update(duenos).set({ bloqueadoHasta: new Date(Date.now() - 1000) }).where(eq(duenos.id, cuenta.idDueno));
        await expect(iniciarSesion(ports, { rol: "dueno", correo: cuenta.correo, contrasena: CONTRASENA })).resolves.toHaveProperty("token");
    });

    it("un acierto reinicia el contador de fallos", async () => {
        const { ports, ultimoCodigo } = puertos();
        const cuenta = await cuentaActiva(ports, ultimoCodigo);
        for (let i = 0; i < 4; i++) {
            await expect(iniciarSesion(ports, { rol: "dueno", correo: cuenta.correo, contrasena: "Mala-Clave-2026!" })).rejects.toThrow(ErrorNoAutorizado);
        }
        await iniciarSesion(ports, { rol: "dueno", correo: cuenta.correo, contrasena: CONTRASENA });

        const [fila] = await db.select().from(duenos).where(eq(duenos.id, cuenta.idDueno));
        expect(fila.intentosFallidos).toBe(0);
    });

    it("el correo de un dueño no inicia sesión como veterinario", async () => {
        const { ports, ultimoCodigo } = puertos();
        const cuenta = await cuentaActiva(ports, ultimoCodigo);
        await expect(iniciarSesion(ports, { rol: "veterinario", correo: cuenta.correo, contrasena: CONTRASENA })).rejects.toThrow("Credenciales inválidas");
    });
});

describe("cuenta profesional", () => {
    it("el veterinario se registra, verifica el correo e inicia sesión con un token de veterinario", async () => {
        const { ports, ultimoCodigo } = puertos();
        const correo = `vet-${randomUUID()}@example.com`;
        const resultado = await registrarVeterinario(ports, { pais: "PE", autoridadEmisora: "CMVP", numeroLicencia: "CMVP-9", correo, contrasena: CONTRASENA });
        rastreador.vetIds.push(resultado.veterinario.id);

        expect(resultado).not.toHaveProperty("token");
        expect(resultado.veterinario.estado).toBe("pendiente");
        const { token } = await verificarCorreo(ports, { rol: "veterinario", correo, codigo: ultimoCodigo() });
        const sesion = await iniciarSesion(ports, { rol: "veterinario", correo, contrasena: CONTRASENA });

        expect(await ports.autenticacion.verifyVetToken(token)).toEqual({ idVeterinario: resultado.veterinario.id });
        expect(await ports.autenticacion.verifyVetToken(sesion.token)).toEqual({ idVeterinario: resultado.veterinario.id });
        const [fila] = await db.select().from(veterinarios).where(eq(veterinarios.id, resultado.veterinario.id));
        expect(fila.correoVerificadoEn).not.toBeNull();
    });
});

describe("reclamo de una cuenta creada por un veterinario", () => {
    const CONTRASENA_AJENA = "Otra-Clave-Distinta-9!";
    const datosReclamo = (documento, correo, contrasena) => ({ tipoDocumento: "DNI", numeroDocumento: documento, nombres: "Rosa", apellidos: "Paredes", correo, contrasena, aceptaTratamientoDatos: true });

    /** Un veterinario aprobado registra a la mascota y al dueño sin contraseña. */
    async function duenoCreadoPorVeterinario() {
        const vet = await crearVeterinarioAislado(rastreador, "aprobado");
        const documento = String(Math.floor(10000000 + Math.random() * 89999999));
        const correo = `rosa-${randomUUID()}@example.com`;
        const ports = { notificacion: { notify: async () => { } }, autenticacion: { issueVetPetAccessToken: async () => ({ token: "t", expiraEn: "2030-01-01T00:00:00.000Z" }) } };
        const resultado = await registrarMascotaPorVeterinario(ports, vet.id, {
            dueno: { tipoDocumento: "DNI", numeroDocumento: documento, nombres: "Rosa", apellidos: "Paredes", correo, aceptaTratamientoDatos: true },
            mascota: { nombre: "Canela", especie: "perro" },
        });
        rastreador.petIds.push(resultado.idMascota);
        const [dueno] = await db.select().from(duenos).where(eq(duenos.correo, correo));
        rastreador.ownerIds.push(dueno.id);
        return { documento, correo, idDueno: dueno.id };
    }

    it("reclamar no toca la cuenta: sigue sin contraseña y la elegida espera junto al código", async () => {
        const { ports } = puertos();
        const { documento, correo, idDueno } = await duenoCreadoPorVeterinario();

        await registrarDueno(ports, datosReclamo(documento, correo, CONTRASENA_AJENA));

        const [dueno] = await db.select().from(duenos).where(eq(duenos.id, idDueno));
        expect(dueno.contrasenaHash).toBeNull();
        const [verificacion] = await db.select().from(verificacionesCorreo).where(eq(verificacionesCorreo.idDueno, idDueno));
        expect(verificacion.contrasenaPendienteHash).toBeTruthy();
        expect(verificacion.contrasenaPendienteHash).not.toContain(CONTRASENA_AJENA);
    });

    it("quien reclama sin poder verificar no bloquea al dueño real: este reclama después y activa su cuenta", async () => {
        const { ports, ultimoCodigo } = puertos();
        const { documento, correo, idDueno } = await duenoCreadoPorVeterinario();

        await registrarDueno(ports, datosReclamo(documento, correo, CONTRASENA_AJENA));
        const reclamoDelDueno = await registrarDueno(ports, datosReclamo(documento, correo, CONTRASENA));
        expect(reclamoDelDueno).toEqual({ idDueno, requiereVerificacion: true });

        const { token } = await verificarCorreo(ports, { rol: "dueno", correo, codigo: ultimoCodigo(), contrasena: CONTRASENA });
        expect(await ports.autenticacion.verifyOwnerToken(token)).toEqual({ idDueno });
        await expect(iniciarSesion(ports, { rol: "dueno", correo, contrasena: CONTRASENA })).resolves.toHaveProperty("token");
    });

    it("el código que llega al buzón del dueño no activa la cuenta con la contraseña de otra persona", async () => {
        const { ports, ultimoCodigo } = puertos();
        const { documento, correo, idDueno } = await duenoCreadoPorVeterinario();
        // Alguien que conoce el documento y el correo inicia el reclamo con su contraseña; el código va al dueño.
        await registrarDueno(ports, datosReclamo(documento, correo, CONTRASENA_AJENA));

        // El dueño teclea el código con su propia contraseña, o sin ninguna: no activa nada.
        await expect(verificarCorreo(ports, { rol: "dueno", correo, codigo: ultimoCodigo(), contrasena: CONTRASENA })).rejects.toThrow("Código inválido o vencido");
        await expect(verificarCorreo(ports, { rol: "dueno", correo, codigo: ultimoCodigo() })).rejects.toThrow("Código inválido o vencido");
        const [dueno] = await db.select().from(duenos).where(eq(duenos.id, idDueno));
        expect(dueno.contrasenaHash).toBeNull();
        expect(dueno.correoVerificadoEn).toBeNull();
    });

    it("un reclamo nuevo deja sin efecto el código del anterior", async () => {
        const { ports, ultimoCodigo } = puertos();
        const { documento, correo } = await duenoCreadoPorVeterinario();
        await registrarDueno(ports, datosReclamo(documento, correo, CONTRASENA_AJENA));
        const codigoViejo = ultimoCodigo();
        await registrarDueno(ports, datosReclamo(documento, correo, CONTRASENA));

        // Los códigos al azar podrían coincidir una vez entre un millón; la prueba lo descarta.
        if (codigoViejo !== ultimoCodigo()) {
            await expect(verificarCorreo(ports, { rol: "dueno", correo, codigo: codigoViejo, contrasena: CONTRASENA_AJENA })).rejects.toThrow(ErrorNoAutorizado);
        }
    });

    it("reenviar el código conserva la contraseña pendiente", async () => {
        const { ports, ultimoCodigo, enviados } = puertos();
        const { documento, correo, idDueno } = await duenoCreadoPorVeterinario();
        await registrarDueno(ports, datosReclamo(documento, correo, CONTRASENA));
        await db.update(verificacionesCorreo).set({ creadoEn: new Date(Date.now() - 120_000) }).where(eq(verificacionesCorreo.idDueno, idDueno));

        await reenviarCodigo(ports, { rol: "dueno", correo });

        expect(enviados.filter((n) => n.template === "codigo_verificacion")).toHaveLength(2);
        await expect(verificarCorreo(ports, { rol: "dueno", correo, codigo: ultimoCodigo(), contrasena: CONTRASENA_AJENA })).rejects.toThrow(ErrorNoAutorizado);
        await expect(verificarCorreo(ports, { rol: "dueno", correo, codigo: ultimoCodigo(), contrasena: CONTRASENA })).resolves.toHaveProperty("token");
    });
});
