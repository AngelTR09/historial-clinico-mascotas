// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ErrorApi } from "../../api/client";
import { obtenerToken, obtenerTokenVeterinario } from "../../lib/auth-storage";
import { PaginaInicioSesion } from "./login-page";
import { PaginaVerificacionCorreo } from "./verify-page";

vi.mock("../../api/client", async (original) => ({ ...(await original()), api: { post: vi.fn() } }));

function montar(ruta = "/login", estado) {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
        <QueryClientProvider client={cliente}>
            <MemoryRouter initialEntries={[{ pathname: ruta, state: estado }]}>
                <Routes>
                    <Route path="/login" element={<PaginaInicioSesion />} />
                    <Route path="/verificar" element={<PaginaVerificacionCorreo />} />
                    <Route path="/dashboard" element={<p>panel del dueño</p>} />
                    <Route path="/vet/dashboard" element={<p>panel del veterinario</p>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    api.post.mockReset();
    localStorage.clear();
});
afterEach(cleanup);

describe("PaginaInicioSesion (RNF 03 y 06)", () => {
    it("el dueño entra con correo y contraseña, y la sesión se guarda", async () => {
        api.post.mockResolvedValue({ token: "token-dueno" });
        montar();
        await userEvent.type(screen.getByLabelText("Correo"), "ana@example.com");
        await userEvent.type(screen.getByLabelText("Contraseña"), "Clave-Segura-2026!");
        await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

        await waitFor(() => expect(screen.getByText("panel del dueño")).toBeTruthy());
        expect(api.post).toHaveBeenCalledWith("/auth/login", { rol: "dueno", correo: "ana@example.com", contrasena: "Clave-Segura-2026!" }, { token: null });
        expect(obtenerToken()).toBe("token-dueno");
    });

    it("el veterinario entra por su rol y su token se guarda aparte", async () => {
        api.post.mockResolvedValue({ token: "token-vet" });
        montar();
        await userEvent.click(screen.getByLabelText("Soy veterinario"));
        await userEvent.type(screen.getByLabelText("Correo"), "vet@example.com");
        await userEvent.type(screen.getByLabelText("Contraseña"), "Clave-Segura-2026!");
        await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

        await waitFor(() => expect(screen.getByText("panel del veterinario")).toBeTruthy());
        expect(obtenerTokenVeterinario()).toBe("token-vet");
        expect(obtenerToken()).toBeNull();
    });

    it("con credenciales malas muestra el error y no guarda sesión", async () => {
        api.post.mockRejectedValue(new ErrorApi("Credenciales inválidas", 401));
        montar();
        await userEvent.type(screen.getByLabelText("Correo"), "ana@example.com");
        await userEvent.type(screen.getByLabelText("Contraseña"), "mala");
        await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

        await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Credenciales inválidas"));
        expect(obtenerToken()).toBeNull();
    });

    it("una cuenta sin verificar ofrece ir a la pantalla del código", async () => {
        api.post.mockRejectedValue(new ErrorApi("Debes verificar tu correo con el código que te enviamos", 403));
        montar();
        await userEvent.type(screen.getByLabelText("Correo"), "ana@example.com");
        await userEvent.type(screen.getByLabelText("Contraseña"), "Clave-Segura-2026!");
        await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

        await userEvent.click(await screen.findByRole("button", { name: "Ingresar el código de verificación" }));
        expect(screen.getByRole("heading", { name: "Verifica tu correo" })).toBeTruthy();
        expect(screen.getByText(/ana@example.com/)).toBeTruthy();
    });

    it("no envía con el correo vacío", async () => {
        montar();
        await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
        await waitFor(() => expect(screen.getByText(/correo/i, { selector: "p" })).toBeTruthy());
        expect(api.post).not.toHaveBeenCalled();
    });
});

describe("PaginaVerificacionCorreo", () => {
    const estado = { rol: "dueno", correo: "ana@example.com" };

    it("sin datos del registro vuelve al inicio de sesión", () => {
        montar("/verificar");
        expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeTruthy();
    });

    it("solo habilita Verificar con 6 dígitos y descarta lo que no es número", async () => {
        montar("/verificar", estado);
        const boton = screen.getByRole("button", { name: "Verificar" });
        await userEvent.type(screen.getByLabelText("Código"), "12ab34");
        expect(screen.getByLabelText("Código").value).toBe("1234");
        expect(boton.disabled).toBe(true);
        await userEvent.type(screen.getByLabelText("Código"), "56");
        expect(boton.disabled).toBe(false);
    });

    it("con el código correcto guarda la sesión y entra al panel", async () => {
        api.post.mockResolvedValue({ token: "token-dueno" });
        montar("/verificar", estado);
        await userEvent.type(screen.getByLabelText("Código"), "123456");
        await userEvent.click(screen.getByRole("button", { name: "Verificar" }));

        await waitFor(() => expect(screen.getByText("panel del dueño")).toBeTruthy());
        expect(api.post).toHaveBeenCalledWith("/auth/verify", { rol: "dueno", correo: "ana@example.com", codigo: "123456" }, { token: null });
        expect(obtenerToken()).toBe("token-dueno");
    });

    it("un código equivocado muestra el error y no da sesión", async () => {
        api.post.mockRejectedValue(new ErrorApi("Código inválido o vencido", 401));
        montar("/verificar", estado);
        await userEvent.type(screen.getByLabelText("Código"), "000000");
        await userEvent.click(screen.getByRole("button", { name: "Verificar" }));

        await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Código inválido o vencido"));
        expect(obtenerToken()).toBeNull();
    });

    it("reenviar pide otro código sin revelar si el correo existe", async () => {
        api.post.mockResolvedValue({ enviado: true });
        montar("/verificar", estado);
        await userEvent.click(screen.getByRole("button", { name: "Reenviar el código" }));

        await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Si tu cuenta sigue sin verificar/));
        expect(api.post).toHaveBeenCalledWith("/auth/resend-code", { rol: "dueno", correo: "ana@example.com" }, { token: null });
    });

    it("el veterinario verificado entra a su panel con su propio token", async () => {
        api.post.mockResolvedValue({ token: "token-vet" });
        montar("/verificar", { rol: "veterinario", correo: "vet@example.com" });
        await userEvent.type(screen.getByLabelText("Código"), "123456");
        await userEvent.click(screen.getByRole("button", { name: "Verificar" }));

        await waitFor(() => expect(screen.getByText("panel del veterinario")).toBeTruthy());
        expect(obtenerTokenVeterinario()).toBe("token-vet");
    });
});
