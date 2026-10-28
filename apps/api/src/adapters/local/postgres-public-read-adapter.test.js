import "../../env.js";
import { esquemaPerfilPublicoMascota } from "@hcm/shared";
import { afterEach, describe, expect, it } from "vitest";
import { limpiarFixtures, crearRastreadorFixtures, crearDuenoYMascotaAislados, crearEventoSaludAislado } from "../../test-support/fixtures.js";
import { AdaptadorLecturaPublicaPostgres } from "./postgres-public-read-adapter.js";
const rastreador = crearRastreadorFixtures();
afterEach(async () => {
    await limpiarFixtures(rastreador);
});
describe("AdaptadorLecturaPublicaPostgres", () => {
    it("proyecta el perfil público sin exponer public_code ni owner_id", async () => {
        const { nombreMascota, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const adaptador = new AdaptadorLecturaPublicaPostgres();
        const perfil = await adaptador.getPetProfileByQrToken(tokenQr);
        expect(perfil).not.toBeNull();
        expect(perfil?.nombreMascota).toBe(nombreMascota);
        expect(perfil).not.toHaveProperty("codigoPublico");
        expect(perfil).not.toHaveProperty("idDueno");
    });
    it("lista las últimas vacunas y omite la que fue corregida por un evento posterior", async () => {
        const { idDueno, idMascota, tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const original = await crearEventoSaludAislado(rastreador, { idMascota, idDueno, tipo: "vacuna", textoOriginal: "Rabia mal escrita", fechaEvento: "2026-01-10" });
        await crearEventoSaludAislado(rastreador, { idMascota, idDueno, tipo: "vacuna", textoOriginal: "Antirrábica", fechaEvento: "2026-01-11", corrigeEventoId: original });
        await crearEventoSaludAislado(rastreador, { idMascota, idDueno, tipo: "chequeo", textoOriginal: "Control general" });
        const perfil = await new AdaptadorLecturaPublicaPostgres().getPetProfileByQrToken(tokenQr);
        expect(perfil?.vacunas.map((vacuna) => vacuna.nombre)).toEqual(["Antirrábica"]);
        expect(perfil?.vacunas[0]).toMatchObject({ fecha: "2026-01-11", nivelConfianza: "declarado" });
    });
    it("proyecta los datos de identificación y cuidado que rellena el dueño", async () => {
        const { tokenQr } = await crearDuenoYMascotaAislados(rastreador, "perro", {
            colorSenas: "manchas blancas en el pecho, oreja caída",
            esterilizada: true,
            temperamento: "asustadiza",
            notaDelDueno: "Tiene miedo a los ruidos fuertes",
        });
        const perfil = await new AdaptadorLecturaPublicaPostgres().getPetProfileByQrToken(tokenQr);
        expect(perfil).toMatchObject({
            colorSenas: "manchas blancas en el pecho, oreja caída",
            esterilizada: true,
            temperamento: "asustadiza",
            notaDelDueno: "Tiene miedo a los ruidos fuertes",
            extraviadaDesde: null,
        });
        expect(esquemaPerfilPublicoMascota.safeParse(perfil).success).toBe(true);
    });
    it("deja en null los datos que el dueño no rellenó (esterilizada sin dato incluida)", async () => {
        const { tokenQr } = await crearDuenoYMascotaAislados(rastreador);
        const perfil = await new AdaptadorLecturaPublicaPostgres().getPetProfileByQrToken(tokenQr);
        expect(perfil).toMatchObject({ colorSenas: null, esterilizada: null, alertasMedicas: null, temperamento: null, notaDelDueno: null, extraviadaDesde: null });
    });
    it("no publica las alertas médicas si el dueño no las autorizó, pero mantiene la clave con null", async () => {
        const { tokenQr } = await crearDuenoYMascotaAislados(rastreador, "perro", { alertasMedicas: "diabética", alertasMedicasPublicas: false });
        const perfil = await new AdaptadorLecturaPublicaPostgres().getPetProfileByQrToken(tokenQr);
        expect(perfil).toHaveProperty("alertasMedicas", null);
        expect(JSON.stringify(perfil)).not.toContain("diabética");
    });
    it("publica las alertas médicas cuando el dueño las autorizó", async () => {
        const { tokenQr } = await crearDuenoYMascotaAislados(rastreador, "perro", { alertasMedicas: "diabética, alérgica a la penicilina", alertasMedicasPublicas: true });
        const perfil = await new AdaptadorLecturaPublicaPostgres().getPetProfileByQrToken(tokenQr);
        expect(perfil?.alertasMedicas).toBe("diabética, alérgica a la penicilina");
    });
    it("publica desde cuándo está extraviada solo si el estado es extraviada, sin lugar", async () => {
        const extraviada = await crearDuenoYMascotaAislados(rastreador, "gato", { estado: "extraviada", extraviadaDesde: "2026-09-01" });
        const activa = await crearDuenoYMascotaAislados(rastreador, "gato", { estado: "activa", extraviadaDesde: "2026-09-01" });
        const adaptador = new AdaptadorLecturaPublicaPostgres();
        expect((await adaptador.getPetProfileByQrToken(extraviada.tokenQr))?.extraviadaDesde).toBe("2026-09-01");
        expect((await adaptador.getPetProfileByQrToken(activa.tokenQr))?.extraviadaDesde).toBeNull();
    });
    it("no expone ubigeo ni datos del dueño aunque estén cargados", async () => {
        const { tokenQr } = await crearDuenoYMascotaAislados(rastreador, "perro", { ubigeoDistrito: "130101" });
        const perfil = await new AdaptadorLecturaPublicaPostgres().getPetProfileByQrToken(tokenQr);
        const texto = JSON.stringify(perfil);
        expect(perfil).not.toHaveProperty("ubigeoDistrito");
        expect(perfil).not.toHaveProperty("idDueno");
        expect(perfil).not.toHaveProperty("codigoPublico");
        expect(texto).not.toContain("130101");
    });
    it("devuelve null para un qr_token inexistente", async () => {
        const adaptador = new AdaptadorLecturaPublicaPostgres();
        expect(await adaptador.getPetProfileByQrToken("token-inexistente")).toBeNull();
    });
});
