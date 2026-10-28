import { INTENTOS_MAXIMOS_CODIGO, MINUTOS_VIGENCIA_CODIGO } from "@hcm/shared";
import { randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { config } from "../../config.js";
import { hmacWithPepper } from "../../crypto/symmetric.js";
import { verificarContrasena, verificarContrasenaFicticia } from "../../crypto/password.js";
import { db } from "../../db/client.js";
import { duenos, verificacionesCorreo, veterinarios } from "../../db/schema.js";
import { esViolacionDeUnicidad } from "../../domain/db-errors.js";
import { ErrorConflicto, ErrorNoAutorizado, ErrorProhibido } from "../../domain/errors.js";
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
 * En el reclamo de una cuenta, `contrasenaPendienteHash` viaja con el código hasta que se verifica.
 */
export async function emitirCodigoVerificacion(ports, rol, cuenta, { contrasenaPendienteHash = null } = {}) {
    const { columnaTitular } = CUENTAS[rol];
    await db
        .update(verificacionesCorreo)
        .set({ consumidoEn: new Date() })
        .where(and(eq(verificacionesCorreo[columnaTitular], cuenta.id), isNull(verificacionesCorreo.consumidoEn)));
    const codigo = codigoNuevo();
    await db.insert(verificacionesCorreo).values({
        [columnaTitular]: cuenta.id,
        hashCodigo: hashDelCodigo(cuenta.id, codigo),
        contrasenaPendienteHash,
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
 * Un reclamo pendiente: cuenta de dueño creada por un veterinario (sin contraseña) con un código vigente que
 * lleva la contraseña elegida al registrarse. Se busca por la verificación y no solo por el correo, porque
 * un mismo correo puede estar en más de una cuenta sin contraseña.
 */
async function buscarReclamoPendiente(correo) {
    const [fila] = await db
        .select({ cuenta: duenos, verificacion: verificacionesCorreo })
        .from(verificacionesCorreo)
        .innerJoin(duenos, eq(verificacionesCorreo.idDueno, duenos.id))
        .where(and(sql `lower(${duenos.correo}) = ${correo.toLowerCase()}`, isNull(duenos.contrasenaHash), isNull(verificacionesCorreo.consumidoEn), gt(verificacionesCorreo.venceEn, new Date()), lt(verificacionesCorreo.intentos, INTENTOS_MAXIMOS_CODIGO), sql `${verificacionesCorreo.contrasenaPendienteHash} IS NOT NULL`))
        .orderBy(desc(verificacionesCorreo.creadoEn))
        .limit(1);
    return fila ?? null;
}
/**
 * Activa la cuenta con el código que llegó al correo y entrega la sesión. Un código vale 15 minutos
 * y admite 5 intentos; agotados, hay que pedir otro. Todos los fallos responden lo mismo.
 * En el reclamo de una cuenta creada por un veterinario hace falta además repetir la contraseña elegida al
 * registrarse: el código llega al buzón del dueño, pero solo la contraseña prueba que quien lo teclea es quien
 * hizo ese registro y no otra persona que lo inició con el mismo documento y correo.
 */
export async function verificarCorreo(ports, { rol, correo, codigo, contrasena }) {
    const { tabla, columnaTitular } = CUENTAS[rol];
    let cuenta = await buscarCuenta(rol, correo);
    let vigente = null;
    if (cuenta) {
        [vigente] = await db
            .select()
            .from(verificacionesCorreo)
            .where(and(eq(verificacionesCorreo[columnaTitular], cuenta.id), isNull(verificacionesCorreo.consumidoEn), gt(verificacionesCorreo.venceEn, new Date()), lt(verificacionesCorreo.intentos, INTENTOS_MAXIMOS_CODIGO)))
            .orderBy(desc(verificacionesCorreo.creadoEn))
            .limit(1);
    }
    else if (rol === "dueno") {
        const reclamo = await buscarReclamoPendiente(correo);
        cuenta = reclamo?.cuenta ?? null;
        vigente = reclamo?.verificacion ?? null;
    }
    if (!cuenta || !vigente) {
        throw new ErrorNoAutorizado(MENSAJE_CODIGO);
    }
    const contrasenaCorrecta = !vigente.contrasenaPendienteHash || (typeof contrasena === "string" && (await verificarContrasena(contrasena, vigente.contrasenaPendienteHash)));
    if (!iguales(vigente.hashCodigo, hashDelCodigo(cuenta.id, codigo)) || !contrasenaCorrecta) {
        await db.update(verificacionesCorreo).set({ intentos: sql `${verificacionesCorreo.intentos} + 1` }).where(eq(verificacionesCorreo.id, vigente.id));
        throw new ErrorNoAutorizado(MENSAJE_CODIGO);
    }
    const cambios = { correoVerificadoEn: cuenta.correoVerificadoEn ?? new Date(), intentosFallidos: 0, bloqueadoHasta: null };
    if (vigente.contrasenaPendienteHash) {
        cambios.contrasenaHash = vigente.contrasenaPendienteHash;
        cambios.fechaConsentimiento = new Date();
    }
    try {
        await db.transaction(async (tx) => {
            await tx.update(verificacionesCorreo).set({ consumidoEn: new Date() }).where(eq(verificacionesCorreo.id, vigente.id));
            await tx.update(tabla).set(cambios).where(eq(tabla.id, cuenta.id));
        });
    }
    catch (error) {
        // Otra cuenta con contraseña tomó ese correo mientras tanto.
        if (esViolacionDeUnicidad(error)) {
            throw new ErrorConflicto("Ya existe una cuenta con este correo");
        }
        throw error;
    }
    return { token: await CUENTAS[rol].emitirToken(ports, cuenta.id) };
}
/**
 * Pide otro código sin revelar si el correo existe: la respuesta es siempre la misma y, dentro del
 * minuto siguiente a un envío, simplemente no se envía otro.
 */
export async function reenviarCodigo(ports, { rol, correo }) {
    let cuenta = await buscarCuenta(rol, correo);
    let pendiente = null;
    if (!cuenta && rol === "dueno") {
        // Reclamo a medias: el código nuevo conserva la contraseña pendiente, que no se puede volver a pedir.
        const reclamo = await buscarReclamoPendiente(correo);
        cuenta = reclamo?.cuenta ?? null;
        pendiente = reclamo?.verificacion.contrasenaPendienteHash ?? null;
    }
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
    await emitirCodigoVerificacion(ports, rol, cuenta, { contrasenaPendienteHash: pendiente });
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
