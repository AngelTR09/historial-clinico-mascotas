/** Vista de la mascota para su dueño autenticado (forma de `esquemaMascota`). */
export function mascotaParaDueno(fila) {
    return {
        id: fila.id,
        idDueno: fila.idDueno,
        codigoPublico: fila.codigoPublico,
        tokenQr: fila.tokenQr,
        nombre: fila.nombre,
        especie: fila.especie,
        raza: fila.raza,
        sexo: fila.sexo,
        fechaNacimientoAprox: fila.fechaNacimientoAprox,
        claveFoto: fila.claveFoto,
        estado: fila.estado,
        ubigeoDistrito: fila.ubigeoDistrito,
        colorSenas: fila.colorSenas,
        esterilizada: fila.esterilizada,
        alertasMedicas: fila.alertasMedicas,
        alertasMedicasPublicas: fila.alertasMedicasPublicas,
        temperamento: fila.temperamento,
        notaDelDueno: fila.notaDelDueno,
        extraviadaDesde: fila.extraviadaDesde,
        creadoEn: fila.creadoEn.toISOString(),
    };
}
