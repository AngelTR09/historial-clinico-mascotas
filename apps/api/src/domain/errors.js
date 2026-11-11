export class ErrorDominio extends Error {
    codigoEstado;
    constructor(mensaje, codigoEstado) {
        super(mensaje);
        this.codigoEstado = codigoEstado;
        this.name = new.target.name;
    }
}
export class ErrorNoEncontrado extends ErrorDominio {
    constructor(mensaje) {
        super(mensaje, 404);
    }
}
export class ErrorProhibido extends ErrorDominio {
    constructor(mensaje) {
        super(mensaje, 403);
    }
}
/** Contraseña correcta pero correo sin verificar: lleva el `rol` para que la web abra la pantalla del código. */
export class ErrorCuentaSinVerificar extends ErrorProhibido {
    datos;
    constructor(mensaje, rol) {
        super(mensaje);
        this.datos = { rol };
    }
}
export class ErrorConflicto extends ErrorDominio {
    constructor(mensaje) {
        super(mensaje, 409);
    }
}
export class ErrorNoAutorizado extends ErrorDominio {
    constructor(mensaje) {
        super(mensaje, 401);
    }
}
export class ErrorSolicitudInvalida extends ErrorDominio {
    constructor(mensaje) {
        super(mensaje, 400);
    }
}
export class ErrorDemasiadasSolicitudes extends ErrorDominio {
    constructor(mensaje = "Demasiadas solicitudes. Intenta de nuevo en un minuto") {
        super(mensaje, 429);
    }
}
