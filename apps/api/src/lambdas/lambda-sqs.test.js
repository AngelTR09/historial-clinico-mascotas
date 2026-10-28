import { describe, expect, it, vi } from "vitest";
import { crearManejadorSqs } from "./lambda-sqs.js";

const mensaje = (id, topic, payload) => ({ messageId: id, body: JSON.stringify({ topic, payload }) });

function armar(manejadorDelTema) {
    const encolados = [];
    const puertos = { cola: { enqueue: async (tema, payload) => void encolados.push({ tema, payload }), subscribe: () => { throw new Error("no debe usarse"); } } };
    const manejador = crearManejadorSqs({ registrar: (p) => p.cola.subscribe("demo", manejadorDelTema(p)), puertos });
    return { manejador, encolados };
}

describe("crearManejadorSqs", () => {
    it("entrega el payload de cada mensaje al worker registrado para su tema", async () => {
        const recibidos = [];
        const { manejador } = armar(() => async (payload) => void recibidos.push(payload));
        const respuesta = await manejador({ Records: [mensaje("1", "demo", { a: 1 }), mensaje("2", "demo", { a: 2 })] });
        expect(recibidos).toEqual([{ a: 1 }, { a: 2 }]);
        expect(respuesta).toEqual({ batchItemFailures: [] });
    });

    it("reporta solo los mensajes que fallaron para que SQS reintente esos y no el lote entero", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { manejador } = armar(() => async (payload) => { if (payload.falla) throw new Error("boom"); });
        const respuesta = await manejador({ Records: [mensaje("ok", "demo", {}), mensaje("mal", "demo", { falla: true }), mensaje("ok2", "demo", {})] });
        expect(respuesta.batchItemFailures).toEqual([{ itemIdentifier: "mal" }]);
    });

    it("un tema que la función no atiende o un cuerpo ilegible cuentan como fallo, no como éxito silencioso", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { manejador } = armar(() => async () => {});
        const respuesta = await manejador({ Records: [mensaje("otro", "otro-tema", {}), { messageId: "roto", body: "{no es json" }] });
        expect(respuesta.batchItemFailures).toEqual([{ itemIdentifier: "otro" }, { itemIdentifier: "roto" }]);
    });

    it("lo que el worker encola sale por la cola real de la función", async () => {
        const { manejador, encolados } = armar((p) => async (payload) => p.cola.enqueue("projector", { idMascota: payload.id }));
        await manejador({ Records: [mensaje("1", "demo", { id: "m1" })] });
        expect(encolados).toEqual([{ tema: "projector", payload: { idMascota: "m1" } }]);
    });
});
