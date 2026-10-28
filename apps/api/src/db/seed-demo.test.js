import "../env.js";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { construirPuertosLocales } from "../container.js";
import { db } from "./client.js";
import { duenos, veterinarios } from "./schema.js";
import { iniciarSesion } from "../use-cases/accounts/account-auth.js";
import { CONTRASENA_DEMO, CORREO_VETERINARIO_DEMO, sembrarCuentasDemo } from "./seed.js";

const ports = construirPuertosLocales();

describe("cuentas de demostración del seed", () => {
    it("el veterinario demo está aprobado y entra con la contraseña conocida", async () => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        await sembrarCuentasDemo();

        const sesion = await iniciarSesion(ports, { rol: "veterinario", correo: CORREO_VETERINARIO_DEMO, contrasena: CONTRASENA_DEMO });
        const [vet] = await db.select().from(veterinarios).where(eq(veterinarios.correo, CORREO_VETERINARIO_DEMO));

        expect(await ports.autenticacion.verifyVetToken(sesion.token)).toEqual({ idVeterinario: vet.id });
        expect(vet.estado).toBe("aprobado");
    });

    it("los dueños sembrados entran por la pantalla, sin pasar por el código del correo", async () => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        await sembrarCuentasDemo();
        const [maria] = await db.select().from(duenos).where(eq(duenos.correo, "maria.quispe@example.com"));
        if (!maria) return; // base sin sembrar: `pnpm db:seed` la crea en CI y en local

        const sesion = await iniciarSesion(ports, { rol: "dueno", correo: "maria.quispe@example.com", contrasena: CONTRASENA_DEMO });

        expect(await ports.autenticacion.verifyOwnerToken(sesion.token)).toEqual({ idDueno: maria.id });
    });

    it("es idempotente: repetirlo no duplica al veterinario ni cambia una contraseña ya fijada", async () => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        await sembrarCuentasDemo();
        const [antes] = await db.select().from(veterinarios).where(eq(veterinarios.correo, CORREO_VETERINARIO_DEMO));

        await sembrarCuentasDemo();

        const filas = await db.select().from(veterinarios).where(eq(veterinarios.correo, CORREO_VETERINARIO_DEMO));
        expect(filas).toHaveLength(1);
        expect(filas[0].contrasenaHash).toBe(antes.contrasenaHash);
    });
});
