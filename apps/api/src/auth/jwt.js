import { HORAS_EXPIRACION_ACCESO_VALIDADOR } from "@hcm/shared";
import { jwtVerify, SignJWT } from "jose";
import { config } from "../config.js";
const claveSecreta = new TextEncoder().encode(config.JWT_SECRET);
/**
 * `PuertoAutenticacion` local: JWT firmado con un secreto simétrico. En la nube lo
 * reemplaza Cognito sin que los casos de uso cambien (sección 13).
 */
export async function signOwnerToken(idDueno) {
    return new SignJWT({ sub: idDueno, role: "owner" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(claveSecreta);
}
export async function verifyOwnerToken(token) {
    const { payload } = await verifyRoleToken(token, "owner");
    return { idDueno: payload.sub };
}
export async function signVetToken(idVeterinario) {
    return new SignJWT({ sub: idVeterinario, role: "vet" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(claveSecreta);
}
export async function verifyVetToken(token) {
    const { payload } = await verifyRoleToken(token, "vet");
    return { idVeterinario: payload.sub };
}
/**
 * RN 10: el acceso de validación nace de escanear el QR de una mascota
 * puntual y expira a las `HORAS_EXPIRACION_ACCESO_VALIDADOR` horas — no
 * es una sesión general del veterinario.
 */
export async function signVetPetAccessToken(idVeterinario, idMascota) {
    const expiraEn = new Date(Date.now() + HORAS_EXPIRACION_ACCESO_VALIDADOR * 60 * 60 * 1000);
    const token = await new SignJWT({ sub: idVeterinario, idMascota, role: "vet-access" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expiraEn)
        .sign(claveSecreta);
    return { token, expiraEn: expiraEn.toISOString() };
}
export async function verifyVetPetAccessToken(token) {
    const { payload } = await verifyRoleToken(token, "vet-access");
    if (typeof payload.idMascota !== "string") {
        throw new Error("Token sin idMascota válido");
    }
    return { idVeterinario: payload.sub, idMascota: payload.idMascota };
}
async function verifyRoleToken(token, role) {
    const result = await jwtVerify(token, claveSecreta, { algorithms: ["HS256"] });
    if (typeof result.payload.sub !== "string" || result.payload.role !== role) {
        throw new Error(`Token inválido para el rol "${role}"`);
    }
    return result;
}
