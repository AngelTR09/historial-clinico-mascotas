// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { PaginaRegistro } from "./register-page";

vi.mock("../../api/client", async (original) => ({ ...(await original()), api: { post: vi.fn() } }));

function montar() {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(<QueryClientProvider client={cliente}><MemoryRouter><PaginaRegistro /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => api.post.mockReset());
afterEach(cleanup);

describe("PaginaRegistro: entradas con lógica real", () => {
    it("el DNI solo admite dígitos y se corta en 8", async () => {
        montar();
        const dni = screen.getByLabelText(/Número de DNI/);
        await userEvent.type(dni, "12ab34-5678 90");
        expect(dni.value).toBe("12345678");
        expect(dni.maxLength).toBe(8);
    });

    it("al elegir pasaporte admite letras y números, en mayúsculas, hasta 12", async () => {
        montar();
        await userEvent.selectOptions(screen.getByLabelText("Documento"), "PASAPORTE");
        const campo = screen.getByLabelText(/Número de Pasaporte/);
        await userEvent.type(campo, "ab-123456xyz99");
        expect(campo.value).toBe("AB123456XYZ9");
    });

    it("los nombres descartan dígitos y símbolos; el teléfono solo deja dígitos", async () => {
        montar();
        await userEvent.type(screen.getByLabelText("Nombres"), "Ana<3>Ruiz");
        expect(screen.getByLabelText("Nombres").value).toBe("AnaRuiz");
        await userEvent.type(screen.getByLabelText(/Teléfono/), "9a44 5566x77");
        expect(screen.getByLabelText(/Teléfono/).value).toBe("944 556677");
    });

    it("un DNI de 7 dígitos no se envía y explica por qué", async () => {
        montar();
        await userEvent.type(screen.getByLabelText(/Número de DNI/), "1234567");
        await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
        expect(await screen.findByText("El DNI debe tener exactamente 8 dígitos")).toBeTruthy();
        await waitFor(() => expect(api.post).not.toHaveBeenCalled());
    });
});
