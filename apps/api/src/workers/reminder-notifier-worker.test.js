import { afterEach, describe, expect, it, vi } from "vitest";
import { AdaptadorColaEnMemoria } from "../adapters/local/in-memory-queue-adapter.js";
import { INTENTOS_RECORDATORIO, TEMA_RECORDATORIO } from "../domain/temas-cola.js";
import { registrarTrabajadorNotificador } from "./reminder-notifier-worker.js";

afterEach(() => vi.restoreAllMocks());

function recordatorio(to) {
    return { to, nombreMascota: "Luna", vacuna: "Antirrábica", vencimiento: "2026-11-01" };
}

describe("notificador de recordatorios (RNF 15 y 18)", () => {
    it("de varios recordatorios, uno falla: los demás se entregan y el fallido llega a la DLQ tras los reintentos", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const intentosPorDestino = new Map();
        const entregados = [];
        const ports = {
            cola: new AdaptadorColaEnMemoria({ maximoIntentosPorTema: { [TEMA_RECORDATORIO]: INTENTOS_RECORDATORIO } }),
            notificacion: {
                notify: async (input) => {
                    intentosPorDestino.set(input.to, (intentosPorDestino.get(input.to) ?? 0) + 1);
                    if (input.to === "falla@example.com") throw new Error("el servicio de notificaciones no responde");
                    entregados.push(input.to);
                },
            },
        };
        registrarTrabajadorNotificador(ports);

        for (const to of ["a@example.com", "falla@example.com", "b@example.com"]) {
            ports.cola.enqueue(TEMA_RECORDATORIO, recordatorio(to));
        }
        await ports.cola.esperarVacia();

        expect(entregados.sort()).toEqual(["a@example.com", "b@example.com"]);
        expect(intentosPorDestino.get("falla@example.com")).toBe(INTENTOS_RECORDATORIO);
        const enDlq = ports.cola.fallidos(TEMA_RECORDATORIO);
        expect(enDlq).toHaveLength(1);
        expect(enDlq[0].payload.to).toBe("falla@example.com");
    });

    it("si el servicio se restablece durante los reintentos, el recordatorio se entrega y no llega a la DLQ", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        let llamadas = 0;
        const ports = {
            cola: new AdaptadorColaEnMemoria({ maximoIntentosPorTema: { [TEMA_RECORDATORIO]: INTENTOS_RECORDATORIO } }),
            notificacion: {
                notify: async () => {
                    llamadas++;
                    if (llamadas === 1) throw new Error("fallo transitorio");
                },
            },
        };
        registrarTrabajadorNotificador(ports);
        ports.cola.enqueue(TEMA_RECORDATORIO, recordatorio("a@example.com"));
        await ports.cola.esperarVacia();
        expect(llamadas).toBe(2);
        expect(ports.cola.fallidos(TEMA_RECORDATORIO)).toHaveLength(0);
    });

    it("pasa el tipo al correo; un mensaje anterior a que existiera `tipo` se entrega como vacuna", async () => {
        const recibidos = [];
        const ports = { cola: new AdaptadorColaEnMemoria(), notificacion: { notify: async (input) => void recibidos.push(input.data.tipo) } };
        registrarTrabajadorNotificador(ports);
        ports.cola.enqueue(TEMA_RECORDATORIO, { ...recordatorio("a@example.com"), tipo: "desparasitacion" });
        ports.cola.enqueue(TEMA_RECORDATORIO, recordatorio("b@example.com"));
        await ports.cola.esperarVacia();
        expect(recibidos).toEqual(["desparasitacion", "vacuna"]);
    });
});
