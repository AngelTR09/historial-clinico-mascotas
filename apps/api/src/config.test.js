import "./env.js";
import { describe, expect, it } from "vitest";
import { esquemaEntorno } from "./config.js";

const valido = () => ({
    DATABASE_URL: "postgresql://u:p@localhost:5432/hcm",
    JWT_SECRET: "un-secreto-de-16+",
    DOC_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    DOC_HMAC_PEPPER: "un-pepper-de-16-car",
});

describe("esquemaEntorno: falla al arrancar, no en producción a media operación", () => {
    it("acepta una configuración válida y OCR apagado por defecto (sección 11)", () => {
        const resultado = esquemaEntorno.safeParse(valido());
        expect(resultado.success).toBe(true);
        expect(resultado.data.OCR_ENABLED).toBe(false);
    });

    it.each([
        ["clave AES de 16 bytes", { DOC_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64") }],
        ["clave AES vacía", { DOC_ENCRYPTION_KEY: "" }],
        ["JWT_SECRET corto", { JWT_SECRET: "corto" }],
        ["pepper corto", { DOC_HMAC_PEPPER: "x" }],
        ["DATABASE_URL que no es URL", { DATABASE_URL: "localhost" }],
    ])("rechaza %s", (_nombre, cambio) => {
        expect(esquemaEntorno.safeParse({ ...valido(), ...cambio }).success).toBe(false);
    });

    it("OCR_ENABLED solo se activa con la cadena exacta 'true'", () => {
        expect(esquemaEntorno.parse({ ...valido(), OCR_ENABLED: "true" }).OCR_ENABLED).toBe(true);
        expect(esquemaEntorno.parse({ ...valido(), OCR_ENABLED: "1" }).OCR_ENABLED).toBe(false);
    });

    it("arma DATABASE_URL desde DB_* codificando la contraseña y exigiendo TLS (RDS)", () => {
        const { DATABASE_URL: _omitida, ...base } = valido();
        const resultado = esquemaEntorno.parse({ ...base, DB_HOST: "hcm.abc.us-east-1.rds.amazonaws.com", DB_USER: "hcm_admin", DB_PASSWORD: "p@ss/w:rd?" });
        expect(resultado.DATABASE_URL).toBe("postgresql://hcm_admin:p%40ss%2Fw%3Ard%3F@hcm.abc.us-east-1.rds.amazonaws.com:5432/hcm?sslmode=require");
    });

    it("exige DATABASE_URL o los tres DB_*", () => {
        const { DATABASE_URL: _omitida, ...base } = valido();
        expect(esquemaEntorno.safeParse(base).success).toBe(false);
        expect(esquemaEntorno.safeParse({ ...base, DB_HOST: "h", DB_USER: "u" }).success).toBe(false);
    });

    it("el modo es local por defecto y con PROVEEDOR=aws exige los recursos de AWS", () => {
        expect(esquemaEntorno.parse(valido()).PROVEEDOR).toBe("local");
        expect(esquemaEntorno.safeParse({ ...valido(), PROVEEDOR: "aws" }).success).toBe(false);
        const completo = {
            ...valido(),
            PROVEEDOR: "aws",
            BUCKET_EVIDENCIAS: "hcm-evidencias-123",
            TABLA_PERFIL_PUBLICO: "hcm-public-profile",
            URL_COLA_NORMALIZACION: "https://sqs.us-east-1.amazonaws.com/123456789012/hcm-normalizacion",
            URL_COLA_PROYECCION: "https://sqs.us-east-1.amazonaws.com/123456789012/hcm-proyeccion",
            CORREO_REMITENTE: "no-responder@hcm.example",
        };
        expect(esquemaEntorno.safeParse(completo).success).toBe(true);
    });

    it("CODIGO_VERIFICACION_FIJO es de 6 dígitos y está prohibido con PROVEEDOR=aws", () => {
        expect(esquemaEntorno.safeParse({ ...valido(), CODIGO_VERIFICACION_FIJO: "123456" }).success).toBe(true);
        expect(esquemaEntorno.safeParse({ ...valido(), CODIGO_VERIFICACION_FIJO: "12345" }).success).toBe(false);
        const aws = {
            ...valido(),
            PROVEEDOR: "aws",
            BUCKET_EVIDENCIAS: "b",
            TABLA_PERFIL_PUBLICO: "t",
            URL_COLA_NORMALIZACION: "https://sqs.us-east-1.amazonaws.com/123456789012/q",
            URL_COLA_PROYECCION: "https://sqs.us-east-1.amazonaws.com/123456789012/p",
            CORREO_REMITENTE: "no-responder@hcm.example",
        };
        expect(esquemaEntorno.safeParse(aws).success).toBe(true);
        expect(esquemaEntorno.safeParse({ ...aws, CODIGO_VERIFICACION_FIJO: "123456" }).success).toBe(false);
    });

    it("con PROVEEDOR=aws exige la cola del proyector y el remitente: sin ellos la ficha o el login no funcionan", () => {
        const aws = {
            ...valido(),
            PROVEEDOR: "aws",
            BUCKET_EVIDENCIAS: "b",
            TABLA_PERFIL_PUBLICO: "t",
            URL_COLA_NORMALIZACION: "https://sqs.us-east-1.amazonaws.com/123456789012/q",
            URL_COLA_PROYECCION: "https://sqs.us-east-1.amazonaws.com/123456789012/p",
            CORREO_REMITENTE: "no-responder@hcm.example",
        };
        expect(esquemaEntorno.safeParse(aws).success).toBe(true);
        expect(esquemaEntorno.safeParse({ ...aws, URL_COLA_PROYECCION: undefined }).success).toBe(false);
        expect(esquemaEntorno.safeParse({ ...aws, CORREO_REMITENTE: undefined }).success).toBe(false);
        expect(esquemaEntorno.safeParse({ ...aws, CORREO_REMITENTE: "no-es-correo" }).success).toBe(false);
    });

    it("la API exige sus tres secretos, pero un trabajador (Lambda) no los necesita", () => {
        const { JWT_SECRET: _a, DOC_ENCRYPTION_KEY: _b, DOC_HMAC_PEPPER: _c, ...sinSecretos } = valido();
        expect(esquemaEntorno.safeParse(sinSecretos).success).toBe(false);
        expect(esquemaEntorno.safeParse({ ...sinSecretos, PROCESO: "trabajador" }).success).toBe(true);
    });
});
