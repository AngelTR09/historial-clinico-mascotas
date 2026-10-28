/**
 * Los scripts destructivos (db:reset, db:rollback) solo corren contra una base local.
 * Sin esto, un `.env` apuntando a RDS por error se vaciaría con un solo comando.
 * Para saltarlo a propósito: HCM_PERMITIR_BASE_REMOTA=si
 */
const ANFITRIONES_LOCALES = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "db"]);

export function exigirBaseLocal(databaseUrl, operacion) {
    const { hostname } = new URL(databaseUrl);
    const esLocal = ANFITRIONES_LOCALES.has(hostname);
    if (process.env.NODE_ENV === "production" || (!esLocal && process.env.HCM_PERMITIR_BASE_REMOTA !== "si")) {
        console.error(`${operacion} rechazado: DATABASE_URL apunta a "${hostname}", que no es una base local.`);
        process.exit(1);
    }
}
