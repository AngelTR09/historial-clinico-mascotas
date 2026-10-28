import { ErrorProhibido, ErrorNoAutorizado } from "../domain/errors.js";
function tokenBearer(request) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        throw new ErrorNoAutorizado("Falta el token Bearer");
    }
    return header.slice("Bearer ".length);
}
/** Exige `Authorization: Bearer <token>` de dueño y adjunta `request.idDueno`. */
export function fabricaExigirDueno(ports) {
    return async function exigirDueno(request, _reply) {
        try {
            const { idDueno } = await ports.autenticacion.verifyOwnerToken(tokenBearer(request));
            request.idDueno = idDueno;
        }
        catch {
            throw new ErrorNoAutorizado("Token inválido o expirado");
        }
    };
}
/** Exige el token de cuenta profesional del veterinario y adjunta `request.idVeterinario`. */
export function fabricaExigirVeterinario(ports) {
    return async function exigirVeterinario(request, _reply) {
        try {
            const { idVeterinario } = await ports.autenticacion.verifyVetToken(tokenBearer(request));
            request.idVeterinario = idVeterinario;
        }
        catch {
            throw new ErrorNoAutorizado("Token inválido o expirado");
        }
    };
}
/**
 * RN 10: exige el token de acceso acotado (nacido de escanear el QR de
 * la mascota) y que apunte exactamente a la mascota de la URL. Un
 * acceso obtenido para una mascota nunca sirve para otra.
 */
export function fabricaExigirAccesoVeterinarioMascota(ports) {
    return async function exigirAccesoVeterinarioMascota(request, _reply) {
        const { idMascota: petIdParam } = request.params;
        let idVeterinario;
        let idMascota;
        try {
            ({ idVeterinario, idMascota } = await ports.autenticacion.verifyVetPetAccessToken(tokenBearer(request)));
        }
        catch {
            throw new ErrorNoAutorizado("Acceso de validación inválido o expirado");
        }
        if (petIdParam && idMascota !== petIdParam) {
            throw new ErrorProhibido("Este acceso no corresponde a esta mascota");
        }
        request.idVeterinario = idVeterinario;
        request.idMascotaAcceso = idMascota;
    };
}
