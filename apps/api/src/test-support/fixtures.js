import { randomBytes, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { encryptSecret, hmacWithPepper } from "../crypto/symmetric.js";
import { db } from "../db/client.js";
import { registroAuditoria, eventosSalud, duenos, mascotas, transferencias, verificacionesCorreo, veterinarios } from "../db/schema.js";
export function crearRastreadorFixtures() {
    return { ownerIds: [], petIds: [], eventIds: [], vetIds: [] };
}
/** Respeta el orden de llaves foráneas: auditoría, eventos, mascotas, dueños, veterinarios. */
export async function limpiarFixtures(rastreador) {
    // audit_log referencia pet_id (RN 9 audita hasta las mascotas de prueba)
    // y debe limpiarse antes que las propias mascotas, o la FK lo bloquea.
    if (rastreador.petIds.length > 0) {
        await db.delete(registroAuditoria).where(inArray(registroAuditoria.idMascota, rastreador.petIds));
    }
    // Una transferencia referencia la mascota (y a sus dos dueños): se borra antes que ellos.
    if (rastreador.petIds.length > 0) {
        await db.delete(transferencias).where(inArray(transferencias.idMascota, rastreador.petIds));
    }
    // Los códigos de verificación referencian al dueño o al veterinario: van antes que ellos.
    if (rastreador.ownerIds.length > 0) {
        await db.delete(verificacionesCorreo).where(inArray(verificacionesCorreo.idDueno, rastreador.ownerIds));
    }
    if (rastreador.vetIds.length > 0) {
        await db.delete(verificacionesCorreo).where(inArray(verificacionesCorreo.idVeterinario, rastreador.vetIds));
    }
    // En orden inverso: un evento corrector (`corrige_evento_id`) se crea después del que corrige.
    for (const id of rastreador.eventIds.splice(0).reverse()) {
        await db.delete(eventosSalud).where(eq(eventosSalud.id, id));
    }
    for (const id of rastreador.petIds.splice(0)) {
        await db.delete(mascotas).where(eq(mascotas.id, id));
    }
    for (const id of rastreador.ownerIds.splice(0)) {
        await db.delete(duenos).where(eq(duenos.id, id));
    }
    for (const id of rastreador.vetIds.splice(0)) {
        await db.delete(veterinarios).where(eq(veterinarios.id, id));
    }
}
export async function crearDuenoAislado(rastreador) {
    const unique = randomUUID();
    const email = `test-fixture-${unique}@example.com`;
    const [dueno] = await db
        .insert(duenos)
        .values({
        tipoDocumento: "DNI",
        numeroDocumentoCifrado: encryptSecret(unique),
        hmacDocumento: hmacWithPepper(unique),
        nombres: "Test",
        apellidos: "Fixture",
        correo: email,
        fechaConsentimiento: new Date(),
    })
        .returning({ id: duenos.id });
    rastreador.ownerIds.push(dueno.id);
    return { id: dueno.id, email };
}
/** `datosExtra`: columnas adicionales de `pets` (p. ej. `colorSenas`, `alertasMedicas`) para el caso a probar. */
export async function crearMascotaAislada(rastreador, idDueno, species = "perro", datosExtra = {}) {
    const unique = randomUUID();
    const name = `TestPet-${unique.slice(0, 8)}`;
    const tokenQr = randomBytes(16).toString("base64url");
    const [mascota] = await db
        .insert(mascotas)
        .values({
        idDueno: idDueno,
        codigoPublico: unique.replace(/-/g, "").slice(0, 9),
        tokenQr: tokenQr,
        nombre: name,
        especie: species,
        estado: "activa",
        ...datosExtra,
    })
        .returning({ id: mascotas.id });
    rastreador.petIds.push(mascota.id);
    return { id: mascota.id, name, tokenQr, idDueno };
}
export async function crearDuenoYMascotaAislados(rastreador, species = "perro", datosExtra = {}) {
    const owner = await crearDuenoAislado(rastreador);
    const pet = await crearMascotaAislada(rastreador, owner.id, species, datosExtra);
    return { idDueno: owner.id, ownerEmail: owner.email, idMascota: pet.id, nombreMascota: pet.name, tokenQr: pet.tokenQr };
}
export async function crearVeterinarioAislado(rastreador, status = "aprobado") {
    const unique = randomUUID();
    const [veterinario] = await db
        .insert(veterinarios)
        .values({
        subUsuario: `test-fixture-${unique}`,
        pais: "PE",
        autoridadEmisora: "CMVP",
        numeroLicencia: `CMVP-${unique.slice(0, 8)}`,
        identificadorFiscal: "20000000000",
        estado: status,
        verificadoEn: status === "aprobado" ? new Date() : null,
    })
        .returning({ id: veterinarios.id });
    rastreador.vetIds.push(veterinario.id);
    return { id: veterinario.id };
}
export async function crearEventoSaludAislado(rastreador, params) {
    const [evento] = await db
        .insert(eventosSalud)
        .values({
        idMascota: params.idMascota,
        tipo: params.tipo ?? "chequeo",
        fechaEvento: params.fechaEvento ?? new Date().toISOString().slice(0, 10),
        textoOriginal: params.textoOriginal ?? "Evento de prueba",
        vacunaCanonicaId: params.vacunaCanonicaId ?? null,
        corrigeEventoId: params.corrigeEventoId ?? null,
        claveIdempotencia: randomUUID(),
        // Un evento lo crea el dueño (declarado) o un veterinario (verificado), nunca ambos (RN 3).
        nivelConfianza: params.nivelConfianza ?? (params.idVeterinario ? "verificado" : "declarado"),
        creadoPor: params.idVeterinario ? null : params.idDueno,
        creadoPorVeterinario: params.idVeterinario ?? null,
    })
        .returning({ id: eventosSalud.id });
    rastreador.eventIds.push(evento.id);
    return evento.id;
}
