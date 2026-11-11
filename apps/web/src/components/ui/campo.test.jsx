// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Campo, Entrada } from "./campo";

afterEach(cleanup);

describe("contador de caracteres", () => {
    it("cuenta lo que se escribe y avisa al llegar al límite", async () => {
        render(<Entrada aria-label="nombre" maxLength={5}/>);
        expect(screen.getByText("0/5")).toBeTruthy();
        await userEvent.type(screen.getByLabelText("nombre"), "Luna");
        expect(screen.getByText("4/5")).toBeTruthy();
        await userEvent.type(screen.getByLabelText("nombre"), "s");
        expect(screen.getByText("5/5").className).toContain("text-clay-ink");
    });

    it("cuenta también el valor inicial", () => {
        render(<Campo etiqueta="Nota" maxLength={20} defaultValue="Responde a su nombre"/>);
        expect(screen.getByText("20/20")).toBeTruthy();
    });

    it("no pone contador sin maxLength, en contraseñas ni en el código de 6 dígitos", () => {
        render(<>
            <Entrada aria-label="fecha" type="date"/>
            <Entrada aria-label="clave" type="password" maxLength={128}/>
            <Campo etiqueta="Código" variante="codigo" maxLength={6}/>
        </>);
        expect(screen.queryByText(/\/\d+/)).toBeNull();
    });
});
