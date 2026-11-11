// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AvatarMascota } from "./pet-avatar";

afterEach(cleanup);

describe("AvatarMascota", () => {
    it("muestra la huella en vez del texto alternativo cuando la foto no carga", () => {
        const { container } = render(<AvatarMascota urlFoto="/local-storage/no-existe.jpg" nombre="Luna"/>);
        fireEvent.error(screen.getByAltText("Foto de Luna"));
        expect(screen.queryByAltText("Foto de Luna")).toBeNull();
        expect(container.querySelector("svg")).toBeTruthy();
    });
});
