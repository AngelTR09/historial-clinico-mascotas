import { afterEach, describe, expect, it, vi } from "vitest";
import { AdaptadorColaSqs, ErrorColaNoConfigurada } from "./sqs-queue-adapter.js";

function clienteFalso({ falla = false } = {}) {
    const enviados = [];
    return {
        enviados,
        send: async (comando) => {
            enviados.push(comando.input);
            if (falla) {
                throw new Error("SQS no responde");
            }
            return {};
        },
    };
}

afterEach(() => vi.restoreAllMocks());

describe("AdaptadorColaSqs (QueuePort sobre SQS)", () => {
    it("enqueue manda { topic, payload } a la cola del tema", async () => {
        const cliente = clienteFalso();
        const cola = new AdaptadorColaSqs({ urls: { normalizer: "https://sqs/normalizacion" }, cliente });
        cola.enqueue("normalizer", { idEvento: "e1" });
        await Promise.resolve();
        expect(cliente.enviados).toHaveLength(1);
        expect(cliente.enviados[0].QueueUrl).toBe("https://sqs/normalizacion");
        expect(JSON.parse(cliente.enviados[0].MessageBody)).toEqual({ topic: "normalizer", payload: { idEvento: "e1" } });
    });

    it("si SQS falla no lanza ni bloquea: RN 8, la escritura nunca depende de la cola", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const cola = new AdaptadorColaSqs({ urls: { normalizer: "https://sqs/n" }, cliente: clienteFalso({ falla: true }) });
        expect(() => cola.enqueue("normalizer", {})).not.toThrow();
        await new Promise((r) => setTimeout(r, 0));
        expect(error).toHaveBeenCalledOnce();
    });

    it("un tema diferido (ocr) se descarta con una sola advertencia", () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
        const cliente = clienteFalso();
        const cola = new AdaptadorColaSqs({ urls: {}, temasOmitidos: ["ocr"], cliente });
        cola.enqueue("ocr", {});
        cola.enqueue("ocr", {});
        expect(cliente.enviados).toHaveLength(0);
        expect(aviso).toHaveBeenCalledOnce();
    });

    it("un tema sin cola ni omisión lanza, para que la ruta no acepte trabajo que se perdería", () => {
        const cola = new AdaptadorColaSqs({ urls: {}, cliente: clienteFalso() });
        expect(() => cola.enqueue("bulk-pet-upload", {})).toThrow(ErrorColaNoConfigurada);
    });

    it("subscribe no hace nada: los consumidores son Lambdas", () => {
        const cola = new AdaptadorColaSqs({ urls: {}, cliente: clienteFalso() });
        expect(() => cola.subscribe("normalizer", async () => {})).not.toThrow();
    });
});

describe("AdaptadorColaSqs: promesa del envío", () => {
    it("enqueue devuelve la promesa del envío para que una Lambda la espere antes de congelarse", async () => {
        const cliente = clienteFalso();
        const cola = new AdaptadorColaSqs({ urls: { reminder: "https://sqs/r" }, cliente });
        await cola.enqueue("reminder", { to: "a@b.c" });
        expect(cliente.enviados).toHaveLength(1);
    });

    it("si SQS falla, quien espera la promesa lo ve (el barrido cuenta el fallo) y quien la ignora no recibe un rechazo sin manejar", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const cola = new AdaptadorColaSqs({ urls: { reminder: "https://sqs/r" }, cliente: clienteFalso({ falla: true }) });
        await expect(cola.enqueue("reminder", {})).rejects.toThrow("SQS no responde");
        cola.enqueue("reminder", {});
        await new Promise((r) => setTimeout(r, 0));
    });
});
