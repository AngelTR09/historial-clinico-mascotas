/**
 * Proyección local: guarda la última ficha de cada token en memoria. En local la lectura
 * pública consulta Postgres directo, así que esto solo simula el camino que en AWS escribe
 * DynamoDB, para ejercitar el proyector sin servicios gestionados. Se pierde al reiniciar.
 */
export class AdaptadorProyeccionEnMemoria {
    perfiles = new Map();
    async guardarPerfil(tokenQr, perfil) {
        this.perfiles.set(tokenQr, structuredClone(perfil));
    }
    /** Solo local, para pruebas y depuración. */
    obtener(tokenQr) {
        return this.perfiles.get(tokenQr) ?? null;
    }
}
