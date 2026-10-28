// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

/**
 * Humo del rediseño visual: cada ruta pública monta sin lanzar, conserva sus
 * textos y acciones clave, y el enlace de salto apunta a un <main> real.
 * Las rutas autenticadas se verifican con la API simulada.
 */
function montar(ruta) {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={cliente}>
            <MemoryRouter initialEntries={[ruta]}>
                <App />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("rutas tras el rediseño", () => {
    it("bienvenida: titular, llamadas a la acción y ancla de contenido", () => {
        const { container } = montar("/");
        expect(screen.getAllByText("Historial Clínico").length).toBeGreaterThan(0);
        expect(document.title).not.toMatch(/trufa/i);
        expect(container.querySelector('header img[src="/img/logo.svg"]')).toBeTruthy();
        expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Cada mascota tiene una huella/);
        const registrar = screen.getAllByRole("link", { name: /Registrar a mi mascota/ });
        expect(registrar.length).toBeGreaterThan(0);
        for (const enlace of registrar) expect(enlace.getAttribute("href")).toBe("/register");
        expect(screen.getAllByRole("link", { name: /Soy veterinario/ }).length).toBeGreaterThan(0);
        expect(screen.getByText("Historial de salud")).toBeTruthy();
        expect(screen.getByText("Placa con código QR")).toBeTruthy();
        expect(screen.getByText("Con nivel de confianza")).toBeTruthy();
        // Las fotos llevan texto alternativo descriptivo, no vacío.
        const fotos = screen.getAllByRole("img").filter((img) => img.getAttribute("src")?.startsWith("/img/"));
        expect(fotos.length).toBe(5);
        for (const foto of fotos) expect(foto.getAttribute("alt").length).toBeGreaterThan(10);
        const salto = screen.getByRole("link", { name: "Saltar al contenido" });
        expect(container.querySelector(salto.getAttribute("href"))?.tagName).toBe("MAIN");
    });

    it("registro de dueño y de veterinario montan con su formulario", () => {
        montar("/register");
        expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
        expect(document.querySelectorAll("form input").length).toBeGreaterThan(0);
        cleanup();
        montar("/vet");
        expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
        expect(document.querySelectorAll("form input").length).toBeGreaterThan(0);
    });

    it("una ruta protegida sin sesión no renderiza el panel", () => {
        montar("/dashboard");
        expect(screen.queryByText("Mis mascotas")).toBeNull();
    });

    it("una ruta desconocida redirige a la bienvenida", () => {
        montar("/no-existe");
        expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/huella/);
    });
});

describe("panel del dueño", () => {
    function simularApi(mascotas) {
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url) => {
                const cuerpo = String(url).includes("/reminders") ? [] : mascotas;
                return new Response(JSON.stringify(cuerpo), { status: 200, headers: { "Content-Type": "application/json" } });
            }),
        );
    }

    async function conSesion() {
        const { establecerToken } = await import("./lib/auth-storage");
        establecerToken("token-de-prueba");
    }

    it("sin mascotas muestra el estado vacío y el formulario de alta", async () => {
        await conSesion();
        simularApi([]);
        montar("/dashboard");
        await waitFor(() => expect(screen.getByText(/Todavía no registraste ninguna mascota/)).toBeTruthy());
        expect(screen.getByRole("button", { name: "Registrar mascota" })).toBeTruthy();
        expect(screen.getByRole("button", { name: /Agregar una foto/ })).toBeTruthy();
    });

    it("con mascotas muestra la tarjeta con sus acciones", async () => {
        await conSesion();
        simularApi([{ id: "a1", nombre: "Luna", especie: "perro", estado: "activa", codigoPublico: "TRU-0001-7", tokenQr: "tok", urlFoto: "http://x.test/luna.jpg" }]);
        montar("/dashboard");
        await waitFor(() => expect(screen.getByText("Luna")).toBeTruthy());
        expect(screen.getByText("TRU-0001-7")).toBeTruthy();
        expect(screen.getByRole("img", { name: "Foto de Luna" }).getAttribute("src")).toBe("http://x.test/luna.jpg");
        expect(screen.getByRole("link", { name: "Ver historial" }).getAttribute("href")).toBe("/pets/a1");
        expect(screen.getByRole("button", { name: /Reportar extraviada/ })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Ver placa QR de Luna" }));
        const qr = screen.getByRole("img", { name: /Código QR de la placa de Luna/ });
        expect(decodeURIComponent(qr.getAttribute("src"))).toContain("<svg");
    });
});

describe("registro de mascota y dueño por el veterinario", () => {
    it("pide la autorización del dueño y envía el alta a /vets/pets", async () => {
        const { establecerTokenVeterinario } = await import("./lib/auth-storage");
        establecerTokenVeterinario("token-vet-de-prueba");
        const llamadas = [];
        vi.stubGlobal("fetch", vi.fn(async (url, opciones) => {
            llamadas.push({ url: String(url), metodo: opciones?.method, cuerpo: opciones?.body });
            return new Response(JSON.stringify({ idMascota: "m1", token: "t", expiraEn: "2030-01-01T00:00:00.000Z" }), { status: 201, headers: { "Content-Type": "application/json" } });
        }));
        montar("/vet/pets/new");
        expect(screen.getByRole("heading", { level: 1, name: /Registrar mascota y dueño/ })).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Registrar y abrir expediente" }));
        await waitFor(() => expect(screen.getByText("Debes confirmar la autorización del dueño")).toBeTruthy());
        expect(llamadas.filter((l) => l.metodo === "POST")).toHaveLength(0);

        const escribir = (etiqueta, valor, indice = 0) => fireEvent.change(screen.getAllByLabelText(etiqueta)[indice], { target: { value: valor } });
        escribir("Número", "45678912");
        escribir("Nombres", "Rosa");
        escribir("Apellidos", "Paredes");
        escribir("Correo", "rosa@example.com");
        escribir("Nombre", "Canela");
        escribir("Especie", "perro");
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(screen.getByRole("button", { name: "Registrar y abrir expediente" }));
        await waitFor(() => expect(llamadas.some((l) => l.metodo === "POST" && l.url.endsWith("/vets/pets"))).toBe(true));
        const envio = JSON.parse(llamadas.find((l) => l.metodo === "POST").cuerpo);
        expect(envio.dueno.numeroDocumento).toBe("45678912");
        expect(envio.dueno.aceptaTratamientoDatos).toBe(true);
        expect(envio.mascota).toMatchObject({ nombre: "Canela", especie: "perro" });
    });
});
