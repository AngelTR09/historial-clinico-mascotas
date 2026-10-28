import { describe, expect, it } from "vitest";
import { esquemaActualizacionMascota } from "./pet.js";

describe("esquemaActualizacionMascota", () => {
    it("acepta texto normal en todos los campos", () => {
        const resultado = esquemaActualizacionMascota.safeParse({
            colorSenas: "manchas blancas en el pecho, oreja caída",
            esterilizada: true,
            alertasMedicas: "diabética, alérgica a la penicilina",
            alertasMedicasPublicas: true,
            temperamento: "asustadiza, no le gusta que la carguen",
            notaDelDueno: "Come dos veces al día. Responde a su nombre.",
        });
        expect(resultado.success).toBe(true);
    });
    it("rechaza un correo electrónico en la nota del dueño con un mensaje en castellano", () => {
        const resultado = esquemaActualizacionMascota.safeParse({ notaDelDueno: "Escríbeme a maria@example.com" });
        expect(resultado.success).toBe(false);
        expect(resultado.error.issues[0].message).toMatch(/teléfono ni correo/);
    });
    it.each(["Llámame al 999888777", "Llámame al 999 888 777", "cel 999-888-777", "(044) 123 456"])("rechaza algo parecido a un teléfono: %s", (texto) => {
        expect(esquemaActualizacionMascota.safeParse({ notaDelDueno: texto }).success).toBe(false);
        expect(esquemaActualizacionMascota.safeParse({ temperamento: texto }).success).toBe(false);
        expect(esquemaActualizacionMascota.safeParse({ colorSenas: texto }).success).toBe(false);
        expect(esquemaActualizacionMascota.safeParse({ alertasMedicas: texto }).success).toBe(false);
    });
    it("acepta números cortos, como una edad o una dosis", () => {
        expect(esquemaActualizacionMascota.safeParse({ notaDelDueno: "Tiene 3 años y pesa 12 kg, 2 pastillas al día" }).success).toBe(true);
    });
    it("limita la nota del dueño a 280 caracteres", () => {
        expect(esquemaActualizacionMascota.safeParse({ notaDelDueno: "a".repeat(280) }).success).toBe(true);
        expect(esquemaActualizacionMascota.safeParse({ notaDelDueno: "a".repeat(281) }).success).toBe(false);
    });
    it("trata la cadena vacía del formulario como borrar el dato (null) y undefined como no tocar", () => {
        const resultado = esquemaActualizacionMascota.parse({ colorSenas: "", temperamento: "   ", esterilizada: null });
        expect(resultado.colorSenas).toBeNull();
        expect(resultado.temperamento).toBeNull();
        expect(resultado.esterilizada).toBeNull();
        expect(resultado.notaDelDueno).toBeUndefined();
    });
    it("rechaza un cuerpo sin ningún dato", () => {
        expect(esquemaActualizacionMascota.safeParse({}).success).toBe(false);
    });
});
