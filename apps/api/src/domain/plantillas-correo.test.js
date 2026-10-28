import { describe, expect, it } from "vitest";
import { ErrorPlantillaDesconocida, renderizarCorreo } from "./plantillas-correo.js";

describe("renderizarCorreo", () => {
    it("el código de verificación incluye el código y su vigencia", () => {
        const { asunto, cuerpo } = renderizarCorreo("codigo_verificacion", { codigo: "123456", minutosVigencia: 10 });
        expect(asunto).toMatch(/código/i);
        expect(cuerpo).toContain("123456");
        expect(cuerpo).toContain("10 minutos");
    });

    it("el recordatorio nombra la mascota, la vacuna y la fecha de vencimiento", () => {
        const { asunto, cuerpo } = renderizarCorreo("recordatorio_vencimiento_vacuna", { nombreMascota: "Luna", vacuna: "Antirrábica", vencimiento: "2026-12-01" });
        expect(asunto).toContain("Luna");
        expect(cuerpo).toContain("Antirrábica");
        expect(cuerpo).toContain("2026-12-01");
    });

    it("el aviso de contacto reenvía el mensaje sin revelar datos del dueño (RN 5)", () => {
        const { cuerpo } = renderizarCorreo("contacto_mascota_perdida", { nombreMascota: "Luna", nombreContacto: "Ana", canalContacto: "ana@example.com", mensaje: "La vi en el parque" });
        expect(cuerpo).toContain("La vi en el parque");
        expect(cuerpo).toContain("ana@example.com");
    });

    it("una plantilla desconocida falla en vez de enviar un correo vacío", () => {
        expect(() => renderizarCorreo("no_existe", {})).toThrow(ErrorPlantillaDesconocida);
    });

    it("el recordatorio de una desparasitación no habla de vacunas", () => {
        const { asunto, cuerpo } = renderizarCorreo("recordatorio_vencimiento_vacuna", { nombreMascota: "Luna", vacuna: "Desparasitación", vencimiento: "2026-12-01", tipo: "desparasitacion" });
        expect(asunto).toBe("Desparasitación por vencer: Luna");
        expect(cuerpo).not.toMatch(/vacuna/i);
    });
});
