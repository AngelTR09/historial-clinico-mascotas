import "../env.js";
import { formatearCodigoPublico } from "@hcm/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { signOwnerToken } from "../auth/jwt.js";
import { config } from "../config.js";
import { hashContrasena } from "../crypto/password.js";
import { encryptSecret, hmacWithPepper } from "../crypto/symmetric.js";
import { mejorCoincidenciaVacuna, UMBRAL_AUTO_MATCH_VACUNA } from "../normalizer/similarity.js";
import { db } from "./client.js";
import { eventosSalud, duenos, mascotas, catalogoVacunas, veterinarios } from "./schema.js";
const semillasCatalogoVacunas = [
    { nombreCanonico: "Antirrábica", especie: "perro", mesesVigencia: 12, intervaloRefuerzoDias: 365 },
    { nombreCanonico: "Séxtuple canina", especie: "perro", mesesVigencia: 12, intervaloRefuerzoDias: 365 },
    { nombreCanonico: "Tos de las perreras (Bordetella)", especie: "perro", mesesVigencia: 12, intervaloRefuerzoDias: 365 },
    { nombreCanonico: "Antirrábica", especie: "gato", mesesVigencia: 12, intervaloRefuerzoDias: 365 },
    { nombreCanonico: "Triple felina", especie: "gato", mesesVigencia: 12, intervaloRefuerzoDias: 365 },
    { nombreCanonico: "Leucemia felina", especie: "gato", mesesVigencia: 12, intervaloRefuerzoDias: 365 },
];
/**
 * Independiente del guard de `duenos`: si alguien ya tenía la base
 * sembrada de una sesión anterior a que existiera el catálogo, un
 * `pnpm db:seed` posterior igual lo completa sin exigir `db:reset`.
 */
async function sembrarCatalogoVacunas() {
    const [row] = await db.select({ count: sql `count(*)::int` }).from(catalogoVacunas);
    if (row && row.count > 0) {
        return;
    }
    console.log("Insertando catálogo canónico de vacunas...");
    await db.insert(catalogoVacunas).values(semillasCatalogoVacunas);
}
const semillasDuenos = [
    { numeroDocumento: "45678912", nombres: "Maria", apellidos: "Quispe Torres", correo: "maria.quispe@example.com", telefono: "+51944556677" },
    { numeroDocumento: "40123456", nombres: "Jose", apellidos: "Rodriguez Vega", correo: "jose.rodriguez@example.com", telefono: "+51955667788" },
    { numeroDocumento: "48765432", nombres: "Lucia", apellidos: "Fernandez Diaz", correo: "lucia.fernandez@example.com", telefono: "+51966778899" },
];
export const CONTRASENA_DEMO = "Demo-Hcm-2026!";
export const CORREO_VETERINARIO_DEMO = "vet.demo@example.com";
/**
 * Cuentas de demostración para entrar por la pantalla de inicio de sesión: los tres dueños sembrados y un
 * veterinario aprobado, todos con la misma contraseña conocida y el correo ya verificado. Es independiente del
 * guard de `duenos` (idempotente, igual que el catálogo): no cambia la contraseña de quien ya tiene una.
 * Una contraseña pública solo es aceptable en una base local, así que con `PROVEEDOR=aws` no hace nada.
 */
export async function sembrarCuentasDemo() {
    if (config.PROVEEDOR !== "local") {
        return;
    }
    const hash = await hashContrasena(CONTRASENA_DEMO);
    const ahora = new Date();
    for (const dueno of semillasDuenos) {
        await db
            .update(duenos)
            .set({ contrasenaHash: hash, correoVerificadoEn: ahora })
            .where(and(eq(duenos.correo, dueno.correo), isNull(duenos.contrasenaHash)));
    }
    const [vetExistente] = await db.select({ id: veterinarios.id }).from(veterinarios).where(eq(veterinarios.correo, CORREO_VETERINARIO_DEMO)).limit(1);
    if (!vetExistente) {
        await db.insert(veterinarios).values({
            subUsuario: randomUUID(),
            pais: "PE",
            autoridadEmisora: "CMVP",
            numeroLicencia: "CMVP-DEMO-0001",
            razonSocial: "Clínica Veterinaria Demo",
            estado: "aprobado",
            verificadoEn: ahora,
            correo: CORREO_VETERINARIO_DEMO,
            contrasenaHash: hash,
            correoVerificadoEn: ahora,
        });
    }
    console.log("\nCuentas de demostración (inicio de sesión por la pantalla, contraseña " + CONTRASENA_DEMO + "):");
    for (const dueno of semillasDuenos) {
        console.log(`  dueño        ${dueno.correo}`);
    }
    console.log(`  veterinario  ${CORREO_VETERINARIO_DEMO}  (aprobado)`);
}
// Datos de identificación y cuidado que rellena el dueño (ficha pública del QR).
// Van por índice de mascota (igual que su código público). Nube y Rocky publican
// sus alertas médicas; Luna las guarda sin autorizar publicarlas; el resto no tiene.
const datosPublicosMascotas = [
    { colorSenas: "Negra con manchas blancas en el pecho, oreja izquierda caída", esterilizada: true, alertasMedicas: "Alérgica a la penicilina", alertasMedicasPublicas: false, temperamento: "Cariñosa, se asusta con los ruidos fuertes", notaDelDueno: "Responde a su nombre. Por favor no la persigan, se deja acariciar si te agachas." },
    { colorSenas: "Atigrado gris con patas blancas", esterilizada: true, alertasMedicas: null, alertasMedicasPublicas: false, temperamento: "Tímido, no le gusta que lo carguen", notaDelDueno: "Solo come alimento balanceado." },
    { colorSenas: "Marrón claro, cicatriz en el lomo y cola corta", esterilizada: false, alertasMedicas: "Diabético: necesita insulina cada 12 horas", alertasMedicasPublicas: true, temperamento: "Juguetón y sociable con personas", notaDelDueno: "Si lo encuentras, por favor mantenlo tranquilo y con agua." },
    { colorSenas: "Blanca, con lunar café sobre el ojo derecho", esterilizada: null, alertasMedicas: null, alertasMedicasPublicas: false, temperamento: "Energética", notaDelDueno: null },
    { colorSenas: "Gris azulada de ojos verdes", esterilizada: true, alertasMedicas: "Cardiópata: evitar que corra o se estrese", alertasMedicasPublicas: true, temperamento: "Reservada con desconocidos", notaDelDueno: "Se esconde si está asustada; llámenla con voz suave." },
];
/**
 * Independiente del guard de `duenos` (igual que el catálogo): completa los
 * datos públicos de las mascotas sembradas que aún no los tienen, para que un
 * `pnpm db:seed` sobre una base anterior a estas columnas no exija `db:reset`.
 * Idempotente: solo toca filas con `markings` nulo.
 */
async function sembrarDatosPublicosMascotas() {
    for (const [indice, datos] of datosPublicosMascotas.entries()) {
        await db.update(mascotas).set(datos).where(and(eq(mascotas.codigoPublico, codigoPublicoParaIndice(indice)), isNull(mascotas.colorSenas)));
    }
}
function nuevoTokenQr() {
    return randomBytes(16).toString("base64url");
}
function codigoPublicoParaIndice(indice) {
    return formatearCodigoPublico(String(indice + 1).padStart(9, "0"));
}
export async function seed() {
    await sembrarCatalogoVacunas();
    const [row] = await db.select({ count: sql `count(*)::int` }).from(duenos);
    if (row && row.count > 0) {
        console.log(`La base ya tiene ${row.count} dueño(s) sembrado(s); no se vuelve a sembrar. Usa "pnpm db:reset" para partir de cero.`);
        await sembrarDatosPublicosMascotas();
        await sembrarCuentasDemo();
        return;
    }
    console.log("Insertando dueños...");
    const duenosInsertados = await db
        .insert(duenos)
        .values(semillasDuenos.map((o) => ({
        tipoDocumento: "DNI",
        numeroDocumentoCifrado: encryptSecret(o.numeroDocumento),
        hmacDocumento: hmacWithPepper(o.numeroDocumento),
        nombres: o.nombres,
        apellidos: o.apellidos,
        correo: o.correo,
        telefonoCifrado: encryptSecret(o.telefono),
        fechaConsentimiento: new Date(),
    })))
        .returning({ id: duenos.id });
    const semillasMascotas = [
        { indiceDueno: 0, nombre: "Luna", especie: "perro", raza: "mestizo", sexo: "hembra", fechaNacimientoAprox: "2021-03-15" },
        { indiceDueno: 0, nombre: "Michi", especie: "gato", raza: "mestizo", sexo: "macho", fechaNacimientoAprox: "2022-07-01" },
        { indiceDueno: 1, nombre: "Rocky", especie: "perro", raza: "criollo", sexo: "macho", fechaNacimientoAprox: "2019-11-20" },
        { indiceDueno: 2, nombre: "Coco", especie: "perro", raza: "poodle", sexo: "hembra", fechaNacimientoAprox: "2023-01-10" },
        { indiceDueno: 2, nombre: "Nube", especie: "gato", raza: "mestizo", sexo: "hembra", fechaNacimientoAprox: "2020-05-30" },
    ];
    console.log("Insertando mascotas...");
    const mascotasInsertadas = await db
        .insert(mascotas)
        .values(semillasMascotas.map((p, indice) => ({
        idDueno: duenosInsertados[p.indiceDueno].id,
        codigoPublico: codigoPublicoParaIndice(indice),
        tokenQr: nuevoTokenQr(),
        nombre: p.nombre,
        especie: p.especie,
        raza: p.raza,
        sexo: p.sexo,
        fechaNacimientoAprox: p.fechaNacimientoAprox,
        estado: "activa",
        ...datosPublicosMascotas[indice],
    })))
        .returning({ id: mascotas.id, idDueno: mascotas.idDueno });
    const plantillasEventos = [
        { tipo: "vacuna", texto: "Antirrábica", confidence: "verificado" },
        { tipo: "vacuna", texto: "Séxtuple canina", confidence: "con_evidencia" },
        { tipo: "chequeo", texto: "Control anual", confidence: "declarado" },
        { tipo: "tratamiento", texto: "Desparasitación interna", confidence: "con_evidencia" },
    ];
    // Vincula cada vacuna sembrada a su entrada canónica con la misma lógica
    // que usaría el normalizador real (RN 7): sin esto, el seed dejaba
    // vacuna_canonica_id siempre en null y el worker de recordatorios nunca
    // tenía nada que mostrar contra los datos "de fábrica".
    const filasCatalogo = await db
        .select({ id: catalogoVacunas.id, nombreCanonico: catalogoVacunas.nombreCanonico, especie: catalogoVacunas.especie })
        .from(catalogoVacunas);
    const catalogoPorEspecie = new Map();
    for (const row of filasCatalogo) {
        const lista = catalogoPorEspecie.get(row.especie) ?? [];
        lista.push({ id: row.id, nombreCanonico: row.nombreCanonico });
        catalogoPorEspecie.set(row.especie, lista);
    }
    console.log("Insertando eventos de salud...");
    const filasEventos = mascotasInsertadas.flatMap((mascota, indiceMascota) => {
        const candidatos = catalogoPorEspecie.get(semillasMascotas[indiceMascota].especie) ?? [];
        return plantillasEventos.map((tpl, indicePlantilla) => {
            const match = tpl.tipo === "vacuna" ? mejorCoincidenciaVacuna(tpl.texto, candidatos) : null;
            return {
                idMascota: mascota.id,
                tipo: tpl.tipo,
                fechaEvento: new Date(2025, indiceMascota + indicePlantilla, 10).toISOString().slice(0, 10),
                textoOriginal: tpl.texto,
                vacunaCanonicaId: match && match.score >= UMBRAL_AUTO_MATCH_VACUNA ? match.candidate.id : null,
                nivelConfianza: tpl.confidence,
                claveIdempotencia: randomUUID(),
                creadoPor: mascota.idDueno,
            };
        });
    });
    await db.insert(eventosSalud).values(filasEventos);
    console.log(`Listo: ${duenosInsertados.length} dueños, ${mascotasInsertadas.length} mascotas, ${filasEventos.length} eventos.`);
    console.log("\nTokens de prueba (Bearer) para cada dueño sembrado:");
    for (let i = 0; i < duenosInsertados.length; i++) {
        const token = await signOwnerToken(duenosInsertados[i].id);
        console.log(`  ${semillasDuenos[i].correo} -> ${token}`);
    }
    await sembrarCuentasDemo();
}
const isEntrypoint = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isEntrypoint) {
    await seed();
    process.exit(0);
}
