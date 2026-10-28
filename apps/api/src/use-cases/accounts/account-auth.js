import { INTENTOS_MAXIMOS_CODIGO, MINUTOS_VIGENCIA_CODIGO } from "@hcm/shared";
import { randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { config } from "../../config.js";
import { hmacWithPepper } from "../../crypto/symmetric.js";
import { verificarContrasena, verificarContrasenaFicticia } from "../../crypto/password.js";
import { db } from "../../db/client.js";
import { duenos, verificacionesCorreo, veterinarios } from "../../db/schema.js";
import { ErrorNoAutorizado, ErrorProhibido } from "../../domain/errors.js";
const INTENTOS_FALLIDOS_PARA_BLOQUEAR = 5;
const MINUTOS_BLOQUEO = 15;
const SEGUNDOS_ENTRE_CODIGOS = 60;
const MENSAJE_CREDENCIALES = "Credenciales inválidas";
const MENSAJE_CODIGO = "Código inválido o vencido";
/**
 * Dueños y veterinarios inician sesión igual (correo + contraseña + código del correo). Lo que
 * cambia es la tabla, la columna que enlaza el código con su titular y el token que se emite.
 */
const CUENTAS = {
    dueno: { tabla: duenos, columnaTitular: "idDueno", emitirToken: (ports, id) => ports.autenticacion.issueOwnerToken(id) },
    veterinario: { tabla: veterinarios, columnaTitular: "idVeterinario", emitirToken: (ports, id) => ports.autenticacion.issueVetToken(id) },
};
/** Solo las cuentas con contraseña pueden iniciar sesión: las anteriores al login solo tenían token. */
async function buscarCuenta(rol, correo) {
    const { tabla } = CUENTAS[rol];
    const [cuenta] = await db
        .select()
        .from(tabla)
        .where(and(sql `lower(${tabla.correo}) = ${correo.toLowerCase()}`, sql `${tabla.contrasenaHash} IS NOT NULL`))
        .limit(1);
    return cuenta ?? null;
}
function codigoNuevo() {
    // El código fijo existe solo para pruebas y demostraciones locales; config.js lo rechaza con PROVEEDOR=aws.
    return config.CODIGO_VERIFICACION_FIJO ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
}
function hashDelCodigo(idTitular, codigo) {
    return hmacWithPepper(`codigo-verificacion:${idTitular}:${codigo}`);
}
function iguales(a, b) {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}
/**
 * Genera un código de 6 dígitos de un solo uso, invalida los anteriores y lo envía por `NotifyPort`.
 * Solo se guarda su HMAC. Un fallo al enviar no tumba el registro: la persona puede pedir otro.
 */
export async function emitirCodigoVerificacion(ports, rol, cuenta) {
    const { columnaTitular } = CUENTAS[rol];
    await db
        .update(verificacionesCorreo)
        .set({ consumidoEn: new Date() })
        .where(and(eq(verificacionesCorreo[columnaTitular], cuenta.id), isNull(verificacionesCorreo.consumidoEn)));
    const codigo = codigoNuevo();
    await db.insert(verificacionesCorreo).values({
        [columnaTitular]: cuenta.id,
        hashCodigo: hashDelCodigo(cuenta.id, codigo),
        venceEn: new Date(Date.now() + MINUTOS_VIGENCIA_CODIGO * 60_000),
    });
    try {
        await ports.notificacion.notify({ to: cuenta.correo, template: "codigo_verificacion", data: { codigo, minutosVigencia: MINUTOS_VIGENCIA_CODIGO } });
    }
    catch (error) {
        console.error("[auth] no se pudo enviar el código de verificación:", error.message);
    }
}
/**
 * Activa la cuenta con el código que llegó al correo y entrega la sesión. Un código vale 15 minutos
 * y admite 5 intentos; agotados, hay que pedir otro. Todos los fallos responden lo mismo.
 */
export async function verificarCorreo(ports, { rol, correo, codigo }) {
    const cuenta = await buscarCuenta(rol, correo);
    if (!cuenta) {
        throw new ErrorNoAutorizado(MENSAJE_CODIGO);
    }
    const { tabla, columnaTitular } = CUENTAS[rol];
    const [vigente] = await db
        .select()
        .from(verificacionesCorreo)
        .where(and(eq(verificacionesCorreo[columnaTitular], cuenta.id), isNull(verificacionesCorreo.consumidoEn), gt(verificacionesCorreo.venceEn, new Date()), lt(verificacionesCorreo.intentos, INTENTOS_MAXIMOS_CODIGO)))
        .orderBy(desc(verificacionesCorreo.creadoEn))
        .limit(1);
    if (!vigente) {
        throw new ErrorNoAutorizado(MENSAJE_CODIGO);
    }
    if (!iguales(vigente.hashCodigo, hashDelCodigo(cuenta.id, codigo))) {
        await db.update(verificacionesCorreo).set({ intentos: sql `${verificacionesCorreo.intentos} + 1` }).where(eq(verificacionesCorreo.id, vigente.id));
        throw new ErrorNoAutorizado(MENSAJE_CODIGO);
    }
    await db.update(verificacionesCorreo).set({ consumidoEn: new Date() }).where(eq(verificacionesCorreo.id, vigente.id));
    await db.update(tabla).set({ correoVerificadoEn: cuenta.correoVerificadoEn ?? new Date(), intentosFallidos: 0, bloqueadoHasta: null }).where(eq(tabla.id, cuenta.id));
    return { token: await CUENTAS[rol].emitirToken(ports, cuenta.id) };
}
/**
 * Pide otro código sin revelar si el correo existe: la respuesta es siempre la misma y, dentro del
 * minuto siguiente a un envío, simplemente no se envía otro.
 */
export async function reenviarCodigo(ports, { rol, correo }) {
    const cuenta = await buscarCuenta(rol, correo);
    if (!cuenta || cuenta.correoVerificadoEn) {
        return;
    }
    const { columnaTitular } = CUENTAS[rol];
    const [ultimo] = await db
        .select({ creadoEn: verificacionesCorreo.creadoEn })
        .from(verificacionesCorreo)
        .where(eq(verificacionesCorreo[columnaTitular], cuenta.id))
        .orderBy(desc(verificacionesCorreo.creadoEn))
        .limit(1);
    if (ultimo && Date.now() - ultimo.creadoEn.getTime() < SEGUNDOS_ENTRE_CODIGOS * 1000) {
        return;
    }
    await emitirCodigoVerificacion(ports, rol, cuenta);
}
/**
 * RNF 03 y 06: sin contraseña correcta no hay sesión. Correo inexistente y contraseña errónea dan el
 * mismo error y tardan lo mismo. Cinco fallos seguidos bloquean la cuenta 15 minutos, y mientras dura
 * el bloqueo ni siquiera se compara la contraseña. Una cuenta sin verificar no entra, y eso solo se
 * dice cuando la contraseña ya fue correcta.
 */
export async function iniciarSesion(ports, { rol, correo, contrasena }) {
    const cuenta = await buscarCuenta(rol, correo);
    if (!cuenta) {
        await verificarContrasenaFicticia(contrasena);
        throw new ErrorNoAutorizado(MENSAJE_CREDENCIALES);
    }
    if (cuenta.bloqueadoHasta && cuenta.bloqueadoHasta.getTime() > Date.now()) {
        throw new ErrorProhibido("Demasiados intentos fallidos. Intenta de nuevo en unos minutos");
    }
    const { tabla } = CUENTAS[rol];
    if (!(await verificarContrasena(contrasena, cuenta.contrasenaHash))) {
        const intentos = cuenta.intentosFallidos + 1;
        const bloquear = intentos >= INTENTOS_FALLIDOS_PARA_BLOQUEAR;
        await db
            .update(tabla)
            .set({ intentosFallidos: bloquear ? 0 : intentos, bloqueadoHasta: bloquear ? new Date(Date.now() + MINUTOS_BLOQUEO * 60_000) : null })
            .where(eq(tabla.id, cuenta.id));
        throw new ErrorNoAutorizado(MENSAJE_CREDENCIALES);
    }
    if (!cuenta.correoVerificadoEn) {
        throw new ErrorProhibido("Debes verificar tu correo con el código que te enviamos");
    }
    await db.update(tabla).set({ intentosFallidos: 0, bloqueadoHasta: null }).where(eq(tabla.id, cuenta.id));
    return { token: await CUENTAS[rol].emitirToken(ports, cuenta.id) };
}
