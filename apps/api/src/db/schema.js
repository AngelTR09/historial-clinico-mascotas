import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex, uuid, } from "drizzle-orm/pg-core";
/**
 * Los valores de estos enums duplican a propósito las constantes de
 * `packages/shared/src/constants.js` en vez de importarlas: `drizzle-kit`
 * carga este archivo con su propio bundler y no resuelve de forma fiable
 * los paquetes ESM del workspace. Si cambia una lista allá, cambia acá
 * también.
 */
export const tipoDocumentoEnum = pgEnum("tipo_documento", ["DNI", "CE", "PASAPORTE"]);
export const estadoMascotaEnum = pgEnum("estado_mascota", ["activa", "extraviada", "fallecida", "transferida"]);
export const tipoEventoSaludEnum = pgEnum("tipo_evento_salud", ["vacuna", "chequeo", "tratamiento", "desparasitacion"]);
export const nivelConfianzaEnum = pgEnum("nivel_confianza", ["declarado", "con_evidencia", "verificado"]);
export const estadoOcrEnum = pgEnum("estado_ocr", ["pendiente", "procesado", "fallido", "omitido"]);
export const estadoVeterinarioEnum = pgEnum("estado_veterinario", ["pendiente", "aprobado", "rechazado"]);
export const estadoCuracionEnum = pgEnum("estado_curacion", ["pendiente", "resuelto", "descartado"]);
export const estadoTransferenciaEnum = pgEnum("estado_transferencia", ["pendiente", "completada", "expirada", "cancelada"]);
export const tipoActorAuditoriaEnum = pgEnum("tipo_actor_auditoria", ["dueno", "veterinario", "municipalidad", "sistema"]);
export const duenos = pgTable("owners", {
    id: uuid("id").primaryKey().defaultRandom(),
    tipoDocumento: tipoDocumentoEnum("doc_type").notNull(),
    numeroDocumentoCifrado: text("doc_number_enc").notNull(),
    hmacDocumento: text("doc_hmac").notNull(),
    nombres: text("first_name").notNull(),
    apellidos: text("last_name").notNull(),
    correo: text("email").notNull(),
    telefonoCifrado: text("phone_enc"),
    creadoEn: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    fechaConsentimiento: timestamp("consent_at", { withTimezone: true }).notNull(),
    // Credenciales de inicio de sesión. Nulas en las cuentas anteriores al login (solo tenían token).
    contrasenaHash: text("password_hash"),
    correoVerificadoEn: timestamp("email_verified_at", { withTimezone: true }),
    intentosFallidos: integer("failed_logins").notNull().default(0),
    bloqueadoHasta: timestamp("locked_until", { withTimezone: true }),
}, (table) => [
    uniqueIndex("owners_doc_hmac_idx").on(table.hmacDocumento),
    // El correo es el nombre de usuario: único entre las cuentas que ya pueden iniciar sesión.
    uniqueIndex("owners_email_login_idx").on(sql `lower(${table.correo})`).where(sql `${table.contrasenaHash} IS NOT NULL`),
]);
export const mascotas = pgTable("pets", {
    id: uuid("id").primaryKey().defaultRandom(),
    idDueno: uuid("owner_id")
        .notNull()
        .references(() => duenos.id),
    codigoPublico: text("public_code").notNull(),
    tokenQr: text("qr_token").notNull(),
    nombre: text("name").notNull(),
    especie: text("species").notNull(),
    raza: text("breed"),
    sexo: text("sex"),
    fechaNacimientoAprox: date("birth_date_approx"),
    claveFoto: text("photo_key"),
    estado: estadoMascotaEnum("status").notNull().default("activa"),
    ubigeoDistrito: text("district_ubigeo"),
    // Datos que el dueño rellena para que quien encuentre al animal pueda
    // identificarlo y cuidarlo. Son texto libre visible en la ficha pública
    // (RN 5): el esquema de entrada rechaza correos y teléfonos.
    colorSenas: text("markings"),
    esterilizada: boolean("is_neutered"),
    alertasMedicas: text("medical_alerts"),
    // Las alertas médicas solo se publican con autorización expresa del dueño.
    alertasMedicasPublicas: boolean("medical_alerts_public").notNull().default(false),
    temperamento: text("temperament"),
    notaDelDueno: text("owner_note"),
    extraviadaDesde: date("lost_since"),
    creadoEn: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("pets_public_code_idx").on(table.codigoPublico),
    uniqueIndex("pets_qr_token_idx").on(table.tokenQr),
    index("pets_owner_id_idx").on(table.idDueno),
]);
export const catalogoVacunas = pgTable("vaccine_catalog", {
    id: uuid("id").primaryKey().defaultRandom(),
    nombreCanonico: text("nombre_canonico").notNull(),
    especie: text("especie").notNull(),
    mesesVigencia: integer("meses_vigencia").notNull(),
    intervaloRefuerzoDias: integer("intervalo_refuerzo_dias"),
    activo: boolean("activo").notNull().default(true),
});
export const eventosSalud = pgTable("health_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    idMascota: uuid("pet_id")
        .notNull()
        .references(() => mascotas.id),
    tipo: tipoEventoSaludEnum("tipo").notNull(),
    fechaEvento: date("event_date").notNull(),
    textoOriginal: text("texto_original").notNull(),
    vacunaCanonicaId: uuid("vacuna_canonica_id").references(() => catalogoVacunas.id),
    nombreProfesional: text("professional_name"),
    nivelConfianza: nivelConfianzaEnum("confidence_level").notNull().default("declarado"),
    corrigeEventoId: uuid("corrige_evento_id").references(() => eventosSalud.id),
    claveIdempotencia: uuid("idempotency_key").notNull(),
    // Exactamente uno de los dos: el dueño que lo declaró o el veterinario que lo registró (RN 3).
    creadoPor: uuid("created_by").references(() => duenos.id),
    creadoPorVeterinario: uuid("created_by_vet").references(() => veterinarios.id),
    creadoEn: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    check("health_events_autor_chk", sql `(${table.creadoPor} IS NOT NULL)::int + (${table.creadoPorVeterinario} IS NOT NULL)::int = 1`),
    uniqueIndex("health_events_idempotency_key_idx").on(table.claveIdempotencia),
    index("health_events_pet_id_event_date_idx").on(table.idMascota, table.fechaEvento.desc()),
]);
export const adjuntos = pgTable("attachments", {
    id: uuid("id").primaryKey().defaultRandom(),
    idEvento: uuid("event_id")
        .notNull()
        .references(() => eventosSalud.id),
    claveS3: text("s3_key").notNull(),
    mime: text("mime").notNull(),
    tamanoBytes: integer("size_bytes").notNull(),
    estadoOcr: estadoOcrEnum("ocr_status").notNull().default("pendiente"),
    datosOcr: jsonb("ocr_payload"),
    confianzaOcr: real("ocr_confidence"),
    creadoEn: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const veterinarios = pgTable("vets", {
    id: uuid("id").primaryKey().defaultRandom(),
    subUsuario: text("user_sub").notNull(),
    pais: text("country").notNull(),
    autoridadEmisora: text("issuing_authority").notNull(),
    numeroLicencia: text("license_number").notNull(),
    identificadorFiscal: text("tax_id"),
    razonSocial: text("razon_social"),
    estado: estadoVeterinarioEnum("status").notNull().default("pendiente"),
    verificadoEn: timestamp("verified_at", { withTimezone: true }),
    correo: text("email"),
    contrasenaHash: text("password_hash"),
    correoVerificadoEn: timestamp("email_verified_at", { withTimezone: true }),
    intentosFallidos: integer("failed_logins").notNull().default(0),
    bloqueadoHasta: timestamp("locked_until", { withTimezone: true }),
}, (table) => [uniqueIndex("vets_email_login_idx").on(sql `lower(${table.correo})`).where(sql `${table.contrasenaHash} IS NOT NULL`)]);
/**
 * Código de 6 dígitos de un solo uso para activar una cuenta (RNF 03). Se guarda solo su HMAC.
 * Pertenece a un dueño o a un veterinario, nunca a ambos.
 */
export const verificacionesCorreo = pgTable("email_verifications", {
    id: uuid("id").primaryKey().defaultRandom(),
    idDueno: uuid("owner_id").references(() => duenos.id),
    idVeterinario: uuid("vet_id").references(() => veterinarios.id),
    hashCodigo: text("code_hash").notNull(),
    // Reclamo de una cuenta creada por un veterinario: la contraseña elegida espera aquí y solo pasa a
    // `owners.password_hash` cuando se verifica el código Y se repite esa contraseña. Hasta entonces la cuenta no
    // tiene contraseña, así que nadie que no tenga el buzón puede dejarla bloqueada ni activarla.
    contrasenaPendienteHash: text("pending_password_hash"),
    venceEn: timestamp("expires_at", { withTimezone: true }).notNull(),
    intentos: integer("attempts").notNull().default(0),
    consumidoEn: timestamp("consumed_at", { withTimezone: true }),
    creadoEn: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    check("email_verifications_titular_chk", sql `(${table.idDueno} IS NOT NULL)::int + (${table.idVeterinario} IS NOT NULL)::int = 1`),
    index("email_verifications_owner_idx").on(table.idDueno),
    index("email_verifications_vet_idx").on(table.idVeterinario),
]);
export const colaCuracion = pgTable("curation_queue", {
    id: uuid("id").primaryKey().defaultRandom(),
    textoOriginal: text("texto_original").notNull(),
    ocurrencias: integer("ocurrencias").notNull().default(1),
    sugerenciaId: uuid("sugerencia_id").references(() => catalogoVacunas.id),
    estado: estadoCuracionEnum("status").notNull().default("pendiente"),
    resueltoEn: timestamp("resolved_at", { withTimezone: true }),
});
export const transferencias = pgTable("transfers", {
    id: uuid("id").primaryKey().defaultRandom(),
    idMascota: uuid("pet_id")
        .notNull()
        .references(() => mascotas.id),
    idDuenoOrigen: uuid("from_owner_id")
        .notNull()
        .references(() => duenos.id),
    idDuenoDestino: uuid("to_owner_id").references(() => duenos.id),
    hashCodigo: text("code_hash").notNull(),
    expiraEn: timestamp("expires_at", { withTimezone: true }).notNull(),
    estado: estadoTransferenciaEnum("status").notNull().default("pendiente"),
    creadaEn: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completadaEn: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
    // RNF 14: la base garantiza que una mascota tenga a lo sumo una cesión pendiente, así 20 solicitudes
    // simultáneas no pueden dejar 20 códigos válidos para la misma mascota.
    uniqueIndex("transfers_pet_pending_idx").on(table.idMascota).where(sql `${table.estado} = 'pendiente'`),
]);
export const registroAuditoria = pgTable("audit_log", {
    id: uuid("id").primaryKey().defaultRandom(),
    tipoActor: tipoActorAuditoriaEnum("actor_type").notNull(),
    idActor: uuid("actor_id"),
    idMascota: uuid("pet_id").references(() => mascotas.id),
    accion: text("action").notNull(),
    hashIp: text("ip_hash").notNull(),
    ocurridoEn: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
