import "../../env.js";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { duenos, mascotas } from "../../db/schema.js";
import { ErrorConflicto, ErrorProhibido } from "../../domain/errors.js";
import { crearRastreadorFixtures, crearVeterinarioAislado, limpiarFixtures } from "../../test-support/fixtures.js";
import { registrarDueno } from "../accounts/register-owner.js";
import { registrarMascotaPorVeterinario } from "./register-pet-by-vet.js";

const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});

function puertos() {
    return {
        notificacion: { notify: async () => { } },
        autenticacion: { issueVetPetAccessToken: async (idVet, idMascota) => ({ token: `vet-${idVet}-${idMascota}`, expiraEn: "2030-01-01T00:00:00.000Z" }) },
    };
}
function entrada(numeroDocumento, correo = `dueno-${randomUUID()}@example.com`) {
    return {
        dueno: { tipoDocumento: "DNI", numeroDocumento, nombres: "Rosa", apellidos: "Paredes", correo, aceptaTratamientoDatos: true },
        mascota: { nombre: "Canela", especie: "perro" },
    };
}
const documentoUnico = () => String(Math.floor(10000000 + Math.random() * 89999999));

async function registrar(ports, idVet, datos) {
    const resultado = await registrarMascotaPorVeterinario(ports, idVet, datos);
    rastreador.petIds.push(resultado.idMascota);
    const [mascota] = await db.select({ idDueno: mascotas.idDueno }).from(mascotas).where(eq(mascotas.id, resultado.idMascota));
    rastreador.ownerIds.push(mascota.idDueno);
    return { resultado, idDueno: mascota.idDueno };
}

describe("registrarMascotaPorVeterinario", () => {
    it("crea al dueño sin contraseña y a su mascota, y da acceso de 4 h al veterinario", async () => {
        const vet = await crearVeterinarioAislado(rastreador, "aprobado");
        const { resultado, idDueno } = await registrar(puertos(), vet.id, entrada(documentoUnico()));
        expect(resultado.duenoNuevo).toBe(true);
        expect(resultado.token).toContain(vet.id);
        expect(resultado.tokenQr).toBeTruthy();
        const [dueno] = await db.select().from(duenos).where(eq(duenos.id, idDueno));
        expect(dueno.contrasenaHash).toBeNull();
        expect(dueno.correoVerificadoEn).toBeNull();
        expect(dueno.numeroDocumentoCifrado).not.toContain(dueno.hmacDocumento);
    });

    it("rechaza al veterinario que no está aprobado", async () => {
        const vet = await crearVeterinarioAislado(rastreador, "pendiente");
        await expect(registrarMascotaPorVeterinario(puertos(), vet.id, entrada(documentoUnico()))).rejects.toBeInstanceOf(ErrorProhibido);
    });

    it("no agrega mascotas a un dueño que ya tiene cuenta activa", async () => {
        const vet = await crearVeterinarioAislado(rastreador, "aprobado");
        const documento = documentoUnico();
        const ports = { ...puertos(), autenticacion: { issueOwnerToken: async () => "t" } };
        const cuenta = await registrarDueno(ports, { tipoDocumento: "DNI", numeroDocumento: documento, nombres: "Ana", apellidos: "Soto", correo: `ana-${randomUUID()}@example.com`, contrasena: "Clave-Segura-2026!", aceptaTratamientoDatos: true });
        rastreador.ownerIds.push(cuenta.idDueno);
        await expect(registrarMascotaPorVeterinario(puertos(), vet.id, entrada(documento))).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it("reutiliza al dueño sin activar si el veterinario registra otra mascota con su documento", async () => {
        const vet = await crearVeterinarioAislado(rastreador, "aprobado");
        const documento = documentoUnico();
        const primera = await registrar(puertos(), vet.id, entrada(documento));
        const segunda = await registrar(puertos(), vet.id, entrada(documento));
        expect(segunda.resultado.duenoNuevo).toBe(false);
        expect(segunda.idDueno).toBe(primera.idDueno);
    });

    it("el dueño reclama la cuenta con el mismo documento y correo, pero no con otro correo", async () => {
        const vet = await crearVeterinarioAislado(rastreador, "aprobado");
        const documento = documentoUnico();
        const correo = `rosa-${randomUUID()}@example.com`;
        const { idDueno } = await registrar(puertos(), vet.id, entrada(documento, correo));
        const enviados = [];
        const ports = { notificacion: { notify: async (n) => void enviados.push(n) }, autenticacion: {} };
        const datos = { tipoDocumento: "DNI", numeroDocumento: documento, nombres: "Rosa", apellidos: "Paredes", contrasena: "Clave-Segura-2026!", aceptaTratamientoDatos: true };

        await expect(registrarDueno(ports, { ...datos, correo: `otro-${randomUUID()}@example.com` })).rejects.toBeInstanceOf(ErrorConflicto);
        const reclamo = await registrarDueno(ports, { ...datos, correo: correo.toUpperCase() });
        expect(reclamo).toEqual({ idDueno, requiereVerificacion: true });
        const [dueno] = await db.select().from(duenos).where(eq(duenos.id, idDueno));
        expect(dueno.contrasenaHash).toBeTruthy();
        expect(dueno.correoVerificadoEn).toBeNull();
    });
});
