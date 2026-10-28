// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { FormularioRegistroVeterinario } from "./vet-event-form";

vi.mock("../../api/client", () => ({ api: { post: vi.fn() } }));

const ID_MASCOTA = "11111111-1111-4111-8111-111111111111";

function montar(propiedades = {}) {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
        <QueryClientProvider client={cliente}>
            <FormularioRegistroVeterinario idMascota={ID_MASCOTA} tokenAcceso="token-de-acceso" {...propiedades} />
        </QueryClientProvider>,
    );
}

beforeEach(() => api.post.mockReset());
afterEach(cleanup);

describe("FormularioRegistroVeterinario (RN 3)", () => {
    it("ofrece la desparasitación entre los tipos de registro", () => {
        montar();
        expect(screen.getByRole("option", { name: "desparasitación" })).toBeTruthy();
    });

    it("manda el registro a la mascota con el token de acceso y una clave de idempotencia", async () => {
        api.post.mockResolvedValue({ id: "e1" });
        montar();
        await userEvent.selectOptions(screen.getByLabelText("Tipo"), "desparasitacion");
        await userEvent.type(screen.getByLabelText("Detalle"), "Desparasitación interna");
        await userEvent.click(screen.getByRole("button", { name: "Registrar" }));

        await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
        const [ruta, cuerpo, opciones] = api.post.mock.calls[0];
        expect(ruta).toBe(`/pets/${ID_MASCOTA}/health-events`);
        expect(cuerpo).toMatchObject({ tipo: "desparasitacion", textoOriginal: "Desparasitación interna" });
        expect(cuerpo.claveIdempotencia).toMatch(/^[0-9a-f-]{36}$/);
        expect(opciones).toEqual({ token: "token-de-acceso" });
    });

    it("no envía con el detalle vacío", async () => {
        montar();
        await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
        await waitFor(() => expect(screen.getByLabelText("Detalle")).toBeTruthy());
        expect(api.post).not.toHaveBeenCalled();
    });

    it("la clave se conserva si el envío falla (reintento seguro) y cambia solo tras confirmarse (RN 6)", async () => {
        api.post.mockRejectedValueOnce(new Error("sin conexión")).mockResolvedValue({ id: "e1" });
        const alRegistrar = vi.fn();
        montar({ alRegistrar });
        await userEvent.type(screen.getByLabelText("Detalle"), "Chequeo general");

        await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
        await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
        await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
        await waitFor(() => expect(alRegistrar).toHaveBeenCalledOnce());

        expect(api.post.mock.calls[1][1].claveIdempotencia).toBe(api.post.mock.calls[0][1].claveIdempotencia);

        await userEvent.type(screen.getByLabelText("Detalle"), "Otro registro");
        await userEvent.click(screen.getByRole("button", { name: "Registrar" }));
        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
        expect(api.post.mock.calls[2][1].claveIdempotencia).not.toBe(api.post.mock.calls[1][1].claveIdempotencia);
    });
});
