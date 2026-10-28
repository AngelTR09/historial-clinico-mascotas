import { esquemaInicioSesion, esquemaReenvioCodigo, esquemaVerificacionCorreo } from "@hcm/shared";
import { iniciarSesion, reenviarCodigo, verificarCorreo } from "../use-cases/accounts/account-auth.js";
/**
 * Inicio de sesión de dueños y veterinarios (RNF 03 y 06). Son públicas a propósito: es donde
 * nace la sesión. En AWS las reemplaza Cognito con el mismo flujo (correo, contraseña y código).
 */
export async function rutasAutenticacion(app, opts) {
    app.post("/auth/login", async (request) => {
        const input = esquemaInicioSesion.parse(request.body);
        return iniciarSesion(opts.ports, input);
    });
    app.post("/auth/verify", async (request) => {
        const input = esquemaVerificacionCorreo.parse(request.body);
        return verificarCorreo(opts.ports, input);
    });
    // Siempre 202 y el mismo cuerpo, exista o no el correo: no se puede enumerar cuentas.
    app.post("/auth/resend-code", async (request, reply) => {
        const input = esquemaReenvioCodigo.parse(request.body);
        await reenviarCodigo(opts.ports, input);
        reply.code(202);
        return { enviado: true };
    });
}
