// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FormularioDatosPublicosMascota } from "./pet-public-data-form";

const mascota = { id: "11111111-1111-4111-8111-111111111111", nombre: "Luna", colorSenas: null, esterilizada: null, alertasMedicas: null, alertasMedicasPublicas: false, temperamento: null, notaDelDueno: null };

function montar() {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={cliente}>
            <FormularioDatosPublicosMascota mascota={mascota} />
        </QueryClientProvider>,
    );
}

afterEach(cleanup);

/**
 * Regresión de 1f41f77: la vista previa depende de useWatch. Si alguien vuelve a
 * watch() o rompe la suscripción, la vista previa deja de reaccionar al tipear.
 */
describe("FormularioDatosPublicosMascota", () => {
    it("renderiza vacío con la vista previa en blanco", () => {
        montar();
        expect(screen.getByText("Todavía no hay datos que mostrar.")).toBeTruthy();
    });

    it("la vista previa se actualiza mientras se escribe", async () => {
        montar();
        await userEvent.type(screen.getByPlaceholderText(/Manchas blancas/), "collar rojo");
        await waitFor(() => expect(screen.getByText("collar rojo")).toBeTruthy());
    });

    it("RN 5: las alertas médicas no se previsualizan como visibles hasta que el dueño las autoriza", async () => {
        montar();
        await userEvent.type(screen.getByPlaceholderText(/Diabética/), "sorda");
        await waitFor(() => expect(screen.getByText(/falta tu autorización/)).toBeTruthy());
        await userEvent.click(screen.getByRole("checkbox"));
        await waitFor(() => expect(screen.queryByText(/falta tu autorización/)).toBeNull());
    });

    it("el botón de guardar está deshabilitado mientras no haya cambios", () => {
        montar();
        expect(screen.getByRole("button", { name: "Guardar datos" }).disabled).toBe(true);
    });
});
