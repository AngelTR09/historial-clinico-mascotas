// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CampoContrasenaVisible } from "./password-input";

afterEach(cleanup);

describe("CampoContrasenaVisible", () => {
    it("oculta la contraseña y la muestra al pulsar el ojo", () => {
        render(<CampoContrasenaVisible aria-label="Clave"/>);
        const campo = screen.getByLabelText("Clave");
        expect(campo.getAttribute("type")).toBe("password");
        fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
        expect(campo.getAttribute("type")).toBe("text");
        fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
        expect(campo.getAttribute("type")).toBe("password");
    });

    it("no envía el formulario al pulsar el ojo", () => {
        let enviado = false;
        render(<form onSubmit={(e) => { e.preventDefault(); enviado = true; }}><CampoContrasenaVisible/></form>);
        fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
        expect(enviado).toBe(false);
    });
});
