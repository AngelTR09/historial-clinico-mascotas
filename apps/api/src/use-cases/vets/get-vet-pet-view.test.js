import "../../env.js";
import { esquemaVistaVeterinarioMascota } from "@hcm/shared";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db/client.js";
import { adjuntos, mascotas } from "../../db/schema.js";
import { ErrorNoEncontrado } from "../../domain/errors.js";
import { limpiarFixtures, crearRastreadorFixtures, crearEventoSaludAislado, crearDuenoYMascotaAislados, crearVeterinarioAislado, } from "../../test-support/fixtures.js";
import { obtenerVistaVeterinarioMascota, resumirDatosOcr } from "./get-vet-pet-view.js";

const puertos = {
    almacenamiento: {
        getDownloadUrl: async (clave) => ({
            url: `http://almacen.test/${encodeURIComponent(clave)}`,
            expiraEn: "2030-01-01T00:00:00.000Z",
        }),
    },
};
const rastreador = crearRastreadorFixtures();
const idsAdjuntosCreados = [];

async function crearAdjunto(idEvento, valores = {}) {
    const [fila] = await db
        .insert(adjuntos)
        .values({ idEvento, claveS3: `attachments/${idEvento}/${crypto.randomUUID()}`, mime: "image/png", tamanoBytes: 1234, ...valores })
        .returning();
    idsAdjuntosCreados.push(fila.id);
    return fila;
}

afterEach(async () => {
    for (const id of idsAdjuntosCreados.splice(0)) {
        await db.delete(adjuntos).where(eq(adjuntos.id, id));
    }
    await limpiarFixtures(rastreador);
});

describe("obtenerVistaVeterinarioMascota", () => {
    it("devuelve la ficha de la mascota y sin ningún dato del dueño (RN 5)", async () => {
        const { idDueno, idMascota, ownerEmail, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        await db.update(mascotas).set({ raza: "Mestizo", sexo: "hembra", claveFoto: "pets/foto-prueba" }).where(eq(mascotas.id, idMascota));
        await crearEventoSaludAislado(rastreador, { idMascota, idDueno });

        const vista = await obtenerVistaVeterinarioMascota(puertos, idMascota);

        // `strict` en el esquema hace fallar cualquier campo de más.
        expect(() => esquemaVistaVeterinarioMascota.parse(vista)).not.toThrow();
        expect(vista.mascota.raza).toBe("Mestizo");
        expect(vista.mascota.urlFoto).toContain("pets%2Ffoto-prueba");
        const texto = JSON.stringify(vista);
        expect(texto).not.toContain(idDueno);
        expect(texto).not.toContain(ownerEmail);
        expect(texto).not.toContain(tokenQr);
        expect(texto).not.toContain("Fixture");
        expect(vista.historial[0]).not.toHaveProperty("creadoPor");
        expect(vista.historial[0]).not.toHaveProperty("creadoPorVeterinario");
    });

    it("lista los adjuntos del evento con URL de lectura, estado y resumen del OCR", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const idEvento = await crearEventoSaludAislado(rastreador, { idMascota, idDueno, tipo: "vacuna", textoOriginal: "Rabia" });
        await crearAdjunto(idEvento, { estadoOcr: "procesado", confianzaOcr: 0.35, datosOcr: { texto: "Vacuna antirrábica lote 123" } });
        await crearAdjunto(idEvento, { estadoOcr: "omitido" });

        const vista = await obtenerVistaVeterinarioMascota(puertos, idMascota);

        expect(vista.historial).toHaveLength(1);
        const [evento] = vista.historial;
        expect(evento.adjuntos).toHaveLength(2);
        const [procesado, omitido] = evento.adjuntos;
        expect(procesado.estadoOcr).toBe("procesado");
        expect(procesado.confianzaOcr).toBeCloseTo(0.35);
        expect(procesado.resumenOcr).toBe("Vacuna antirrábica lote 123");
        expect(procesado.urlLectura).toMatch(/^http:\/\/almacen\.test\/attachments/);
        expect(procesado.urlLecturaExpiraEn).toBe("2030-01-01T00:00:00.000Z");
        expect(procesado).not.toHaveProperty("claveS3");
        expect(omitido.estadoOcr).toBe("omitido");
        expect(omitido.resumenOcr).toBeNull();
    });

    it("muestra todo el historial, sin bandeja de validación: lo del dueño declarado y lo del veterinario verificado", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const veterinario = await crearVeterinarioAislado(rastreador);
        const idDelDueno = await crearEventoSaludAislado(rastreador, { idMascota, idDueno, tipo: "vacuna", textoOriginal: "Rabia", fechaEvento: "2026-07-01" });
        const idDelVeterinario = await crearEventoSaludAislado(rastreador, { idMascota, idVeterinario: veterinario.id, tipo: "desparasitacion", textoOriginal: "Desparasitación", fechaEvento: "2026-09-01" });

        const vista = await obtenerVistaVeterinarioMascota(puertos, idMascota);

        expect(vista).not.toHaveProperty("pendientes");
        expect(vista.historial.map((e) => e.id)).toEqual([idDelVeterinario, idDelDueno]);
        expect(vista.historial.map((e) => e.nivelConfianza)).toEqual(["verificado", "declarado"]);
        expect(vista.historial[0].tipo).toBe("desparasitacion");
        expect(vista.historial[0].creadoEn).toMatch(/^\d{4}-\d\d-\d\dT/);
        expect(vista.historial[0]).not.toHaveProperty("estadoRevision");
        expect(vista.historial[0]).not.toHaveProperty("validacion");
    });

    it("muestra la relación de corrección (RN 2) hacia ambos lados", async () => {
        const { idDueno, idMascota } = await crearDuenoYMascotaAislados(rastreador);
        const idOriginal = await crearEventoSaludAislado(rastreador, { idMascota, idDueno, tipo: "vacuna", textoOriginal: "Rabia 2025", fechaEvento: "2026-01-10" });
        const idCorreccion = await crearEventoSaludAislado(rastreador, { idMascota, idDueno, tipo: "vacuna", textoOriginal: "Rabia 2026", fechaEvento: "2026-01-10", corrigeEventoId: idOriginal });

        const vista = await obtenerVistaVeterinarioMascota(puertos, idMascota);

        const correccion = vista.historial.find((e) => e.id === idCorreccion);
        const original = vista.historial.find((e) => e.id === idOriginal);
        expect(correccion.corrigeEventoId).toBe(idOriginal);
        expect(correccion.corrigeEvento).toEqual({ fechaEvento: "2026-01-10", tipo: "vacuna", textoOriginal: "Rabia 2025" });
        expect(original.corregidoPorEventoId).toBe(idCorreccion);
        expect(original.corrigeEventoId).toBeNull();
    });

    it("no mezcla eventos ni adjuntos de otra mascota", async () => {
        const propia = await crearDuenoYMascotaAislados(rastreador);
        const ajena = await crearDuenoYMascotaAislados(rastreador);
        await crearEventoSaludAislado(rastreador, { idMascota: propia.idMascota, idDueno: propia.idDueno, textoOriginal: "Propio" });
        const idAjeno = await crearEventoSaludAislado(rastreador, { idMascota: ajena.idMascota, idDueno: ajena.idDueno, textoOriginal: "Ajeno" });
        await crearAdjunto(idAjeno);

        const vista = await obtenerVistaVeterinarioMascota(puertos, propia.idMascota);

        expect(vista.historial.map((e) => e.textoOriginal)).toEqual(["Propio"]);
        expect(vista.historial[0].adjuntos).toEqual([]);
    });

    it("lanza ErrorNoEncontrado si la mascota no existe", async () => {
        await expect(obtenerVistaVeterinarioMascota(puertos, crypto.randomUUID())).rejects.toThrow(ErrorNoEncontrado);
    });
});

describe("resumirDatosOcr", () => {
    it("resume texto, valores simples y descarta lo que no es utilizable", () => {
        expect(resumirDatosOcr(null)).toBeNull();
        expect(resumirDatosOcr({ texto: "  Hola  " })).toBe("Hola");
        expect(resumirDatosOcr({ engine: "stub", nota: "fijo", anidado: { a: 1 } })).toBe("engine: stub · nota: fijo");
        expect(resumirDatosOcr({ anidado: { a: 1 } })).toBeNull();
        expect(resumirDatosOcr({ texto: "x".repeat(500) })).toHaveLength(301);
    });
});
