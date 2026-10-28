import "../env.js";
import { randomUUID } from "node:crypto";
import { HORAS_EXPIRACION_ACCESO_VALIDADOR } from "@hcm/shared";
import { SignJWT, decodeJwt } from "jose";
import { describe, expect, it } from "vitest";
import { signOwnerToken, signVetPetAccessToken, signVetToken, verifyOwnerToken, verifyVetPetAccessToken, verifyVetToken } from "./jwt.js";

describe("tokens de sesión", () => {
    it("RN 10: el acceso del veterinario a una mascota expira en 4 horas como máximo", async () => {
        expect(HORAS_EXPIRACION_ACCESO_VALIDADOR).toBeLessThanOrEqual(4);
        const { token } = await signVetPetAccessToken(randomUUID(), randomUUID());
        const { exp, iat } = decodeJwt(token);
        expect(exp - iat).toBeLessThanOrEqual(4 * 3600);
    });

    it("un token de dueño no sirve como veterinario ni como acceso a mascota (y viceversa)", async () => {
        const dueno = await signOwnerToken(randomUUID());
        const vet = await signVetToken(randomUUID());
        const { token: acceso } = await signVetPetAccessToken(randomUUID(), randomUUID());
        await expect(verifyVetToken(dueno)).rejects.toThrow();
        await expect(verifyVetPetAccessToken(dueno)).rejects.toThrow();
        await expect(verifyOwnerToken(vet)).rejects.toThrow();
        await expect(verifyOwnerToken(acceso)).rejects.toThrow();
        await expect(verifyVetToken(acceso)).rejects.toThrow();
    });

    it("el acceso a mascota lleva la mascota para la que se emitió", async () => {
        const idMascota = randomUUID();
        const { token } = await signVetPetAccessToken(randomUUID(), idMascota);
        expect((await verifyVetPetAccessToken(token)).idMascota).toBe(idMascota);
    });

    it("rechaza un token firmado con otro secreto", async () => {
        const falso = await new SignJWT({ sub: randomUUID(), role: "owner" })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1h")
            .sign(new TextEncoder().encode("otro-secreto-distinto"));
        await expect(verifyOwnerToken(falso)).rejects.toThrow();
    });

    it("rechaza un token expirado", async () => {
        const secreto = new TextEncoder().encode(process.env.JWT_SECRET);
        const expirado = await new SignJWT({ sub: randomUUID(), role: "owner" })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
            .sign(secreto);
        await expect(verifyOwnerToken(expirado)).rejects.toThrow();
    });

    it("rechaza alg=none (token sin firma)", async () => {
        const base64 = (objeto) => Buffer.from(JSON.stringify(objeto)).toString("base64url");
        const sinFirma = `${base64({ alg: "none", typ: "JWT" })}.${base64({ sub: randomUUID(), role: "owner" })}.`;
        await expect(verifyOwnerToken(sinFirma)).rejects.toThrow();
    });
});
