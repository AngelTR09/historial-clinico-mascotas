import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { OPCIONES_REDACCION } from "./logging.js";

function registrar(objeto) {
    const lineas = [];
    const destino = new Writable({ write(trozo, _codificacion, listo) { lineas.push(trozo.toString()); listo(); } });
    pino({ redact: OPCIONES_REDACCION }, destino).info(objeto, "prueba");
    return lineas.join("");
}

describe("redacción de logs", () => {
    it.each([
        ["numeroDocumento", { numeroDocumento: "12345678" }, "12345678"],
        ["correo (nombre real en este código)", { correo: "ana@example.com" }, "ana@example.com"],
        ["telefono (nombre real en este código)", { telefono: "999888777" }, "999888777"],
        ["email anidado", { body: { dueno: { email: "ana@example.com" } } }, "ana@example.com"],
        ["phone anidado", { owner: { phone: "999888777" } }, "999888777"],
        ["código de transferencia", { body: { codigo: "A1B2C3D4E5" } }, "A1B2C3D4E5"],
        ["Authorization", { req: { headers: { authorization: "Bearer secreto.jwt.token" } } }, "secreto.jwt.token"],
    ])("no deja pasar %s", (_nombre, objeto, secreto) => {
        expect(registrar(objeto)).not.toContain(secreto);
    });

    it("no censura campos que no son sensibles", () => {
        expect(registrar({ idMascota: "abc" })).toContain("abc");
    });
});
