// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ErrorApi } from "../../api/client";
import { PaginaPanel } from "./dashboard-page";

vi.mock("../../api/client", async (original) => ({ ...(await original()), api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

const mascota = (id, nombre, codigoPublico) => ({ id, nombre, especie: "perro", estado: "activa", codigoPublico, tokenQr: `qr${id}`, urlFoto: null });
const LUNA = mascota("11111111-1111-4111-8111-111111111111", "Luna", "0000000019");
const MICHI = mascota("22222222-2222-4222-8222-222222222222", "Michi", "0000000027");

function montar() {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(<QueryClientProvider client={cliente}><MemoryRouter><PaginaPanel /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
    api.get.mockReset().mockImplementation(async (ruta) => (ruta === "/pets" ? [LUNA, MICHI] : []));
    api.post.mockReset().mockImplementation(async (ruta, cuerpo) => {
        if (ruta === "/transfers" && cuerpo.idMascota === MICHI.id) {
            throw new ErrorApi("Ya hay una transferencia pendiente", 409);
        }
        return { transferencia: { id: "t-1", idMascota: cuerpo.idMascota }, codigo: "ABCDEF0123" };
    });
});
afterEach(cleanup);

const verQr = (nombre) => screen.getByRole("button", { name: `Ver placa QR de ${nombre}` });
const transferir = (nombre) => screen.getByRole("button", { name: `Transferir a ${nombre} a otro dueño` });
const hayQr = () => screen.queryAllByText("Código de la mascota").length;
const hayCodigo = () => screen.queryAllByText(/solo se muestra una vez y vence/).length;

describe("dashboard: un solo panel abierto a la vez", () => {
    it("abrir la transferencia cierra el QR de la misma mascota, y al revés", async () => {
        montar();
        await screen.findByText("Luna");
        await userEvent.click(verQr("Luna"));
        expect(hayQr()).toBe(1);
        await userEvent.click(transferir("Luna"));
        await waitFor(() => expect(hayCodigo()).toBe(1));
        expect(hayQr()).toBe(0);
        await userEvent.click(verQr("Luna"));
        expect(hayQr()).toBe(1);
        expect(hayCodigo()).toBe(0);
    });

    it("abrir un panel de otra mascota cierra el que estaba abierto", async () => {
        montar();
        await screen.findByText("Luna");
        await userEvent.click(verQr("Luna"));
        await userEvent.click(verQr("Michi"));
        expect(hayQr()).toBe(1);
        expect(screen.getByAltText("Código QR de la placa de Michi")).toBeTruthy();
        expect(screen.queryByAltText("Código QR de la placa de Luna")).toBeNull();
        await userEvent.click(transferir("Luna"));
        await waitFor(() => expect(hayCodigo()).toBe(1));
        expect(hayQr()).toBe(0);
    });

    it("el aviso de transferencia pendiente también se cierra al abrir otro panel, y el código de Luna se conserva", async () => {
        montar();
        await screen.findByText("Luna");
        await userEvent.click(transferir("Luna"));
        await waitFor(() => expect(hayCodigo()).toBe(1));
        await userEvent.click(transferir("Michi"));
        await screen.findByText(/Ya hay una transferencia pendiente para Michi/);
        expect(hayCodigo()).toBe(0);
        await userEvent.click(verQr("Luna"));
        expect(screen.queryByText(/Ya hay una transferencia pendiente para Michi/)).toBeNull();
        await userEvent.click(transferir("Luna"));
        expect(hayCodigo()).toBe(1);
        expect(screen.getByText("t-1:ABCDEF0123")).toBeTruthy();
        expect(api.post).toHaveBeenCalledTimes(2);
    });
});
