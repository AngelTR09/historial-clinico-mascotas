// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectorFotoMascota } from "./pet-photo-picker";

afterEach(cleanup);

describe("SelectorFotoMascota", () => {
    it("ofrece tomar foto con la cámara y elegir de la galería", async () => {
        render(<SelectorFotoMascota nombre="Luna" alElegir={() => {}} />);
        await userEvent.click(screen.getByRole("button", { name: /Agregar una foto de Luna/ }));
        expect(screen.getByRole("menuitem", { name: /Tomar foto/ })).toBeTruthy();
        expect(screen.getByRole("menuitem", { name: /Elegir de la galería/ })).toBeTruthy();
        // En celulares `capture` abre la cámara directamente.
        expect(screen.getByLabelText("Tomar foto con la cámara").getAttribute("capture")).toBe("environment");
        expect(screen.getByLabelText("Elegir foto de la galería").getAttribute("capture")).toBeNull();
    });

    it("entrega el archivo elegido y cierra el menú", async () => {
        const alElegir = vi.fn();
        render(<SelectorFotoMascota nombre="Luna" alElegir={alElegir} />);
        await userEvent.click(screen.getByRole("button", { name: /Agregar una foto/ }));
        const archivo = new File(["x"], "luna.jpg", { type: "image/jpeg" });
        await userEvent.upload(screen.getByLabelText("Tomar foto con la cámara"), archivo);
        expect(alElegir).toHaveBeenCalledWith(archivo);
        expect(screen.queryByRole("menu")).toBeNull();
    });

    it("muestra la foto actual, el estado ocupado y el error", () => {
        render(<SelectorFotoMascota nombre="Luna" urlFoto="http://x.test/luna.jpg" ocupado error="No se pudo subir" alElegir={() => {}} />);
        expect(screen.getByRole("img", { name: "Foto de Luna" }).getAttribute("src")).toBe("http://x.test/luna.jpg");
        expect(screen.getByRole("button", { name: /Cambiar la foto de Luna/ }).disabled).toBe(true);
        expect(screen.getByRole("alert").textContent).toBe("No se pudo subir");
    });
});
