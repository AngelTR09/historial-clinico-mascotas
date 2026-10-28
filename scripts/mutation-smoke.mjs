#!/usr/bin/env node
/**
 * Mutación manual de las partes críticas. Por cada entrada rompe UNA cosa pequeña
 * en el código, corre solo los tests que deberían notarlo y exige que fallen.
 * Si una mutación "sobrevive" (los tests siguen en verde), esa regla no está protegida.
 * Restaura siempre el archivo original, incluso con Ctrl+C. Uso: pnpm mutation:smoke
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUTACIONES = [
    { regla: "RN 6  idempotencia: clave de otra mascota", paquete: "api", archivo: "apps/api/src/use-cases/health/register-health-event.js", de: "existente.idMascota !== input.idMascota", a: "false", tests: ["src/routes/health-events.test.js"] },
    { regla: "RN 3/4 dueño ajeno puede escribir en mascota ajena", paquete: "api", archivo: "apps/api/src/use-cases/health/register-health-event.js", de: "eq(mascotas.idDueno, idDueno)", a: "eq(mascotas.idDueno, mascotas.idDueno)", tests: ["src/routes/health-events.test.js", "src/use-cases/health/register-health-event.test.js"] },
    { regla: "RN 10 acceso del validador sirve para otra mascota", paquete: "api", archivo: "apps/api/src/plugins/auth.js", de: "idMascota !== petIdParam", a: "false", tests: ["src/routes/validations.test.js"] },
    { regla: "RN 10 acceso del validador dura 48 h", paquete: "shared", archivo: "packages/shared/src/constants.js", de: "HORAS_EXPIRACION_ACCESO_VALIDADOR = 4", a: "HORAS_EXPIRACION_ACCESO_VALIDADOR = 48", tests: ["src/schemas/contracts.test.js"] },
    { regla: "RN 10 JWT acepta cualquier rol", paquete: "api", archivo: "apps/api/src/auth/jwt.js", de: "result.payload.role !== role", a: "false", tests: ["src/auth/jwt.test.js"] },
    { regla: "RN 5  alertas médicas privadas salen en la ficha pública", paquete: "api", archivo: "apps/api/src/adapters/local/postgres-public-read-adapter.js", de: "mascota.alertasMedicasPublicas ? mascota.alertasMedicas : null", a: "mascota.alertasMedicas", tests: ["src/routes/public.test.js", "src/adapters/local/postgres-public-read-adapter.test.js"] },
    { regla: "RN 5  filtro de teléfonos/correos en textos públicos", paquete: "shared", archivo: "packages/shared/src/schemas/primitives.js", de: "return !PATRON_CORREO.test(texto) && !PATRON_SECUENCIA_TELEFONICA.test(texto);", a: "return true;", tests: ["src/schemas/contracts.test.js", "src/schemas/pet.test.js"] },
    { regla: "Transferencia: cualquiera canjea sin el código", paquete: "api", archivo: "apps/api/src/use-cases/transfers/redeem-transfer.js", de: "transferencia.hashCodigo !== hmacWithPepper(input.codigo)", a: "false", tests: ["src/use-cases/transfers/transfer-flow.test.js"] },
    { regla: "public_code: reintento por colisión", paquete: "api", archivo: "apps/api/src/domain/db-errors.js", de: "(error.code === UNIQUE_VIOLATION || error.cause?.code === UNIQUE_VIOLATION)", a: "false", tests: ["src/use-cases/pets/register-pet-collision.test.js", "src/domain/db-errors.test.js"] },
    { regla: "Sección 11: OCR encendido por defecto", paquete: "api", archivo: "apps/api/src/config.js", de: '.default("false")', a: '.default("true")', tests: ["src/config.test.js"] },
    { regla: "Ruta del API borrada del arranque (contrato web→API)", paquete: "api", archivo: "apps/api/src/app.js", de: "await app.register(rutasTransferencias, { ports });", a: "", tests: ["src/contract/web-api-contract.test.js"] },
    { regla: "Ruta nueva sin autenticación", paquete: "api", archivo: "apps/api/src/routes/reminders.js", de: "{ preHandler: exigirDueno }", a: "{}", tests: ["src/routes/auth-guard.test.js"] },
    { regla: "Migraciones: la reversión no borra su fila", paquete: "api", archivo: "apps/api/src/db/migration-runner.js", de: "await tx`DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations)`;", a: "", tests: ["src/db/migrations.test.js"] },
    { regla: "Web: el QR de la placa ya no se reduce al token", paquete: "shared", archivo: "packages/shared/src/utils/qr-token.js", de: "return decodeURIComponent(coincidencia[1]);", a: "return limpio;", tests: ["src/utils/qr-token.test.js"] },
    { regla: "Web: el cliente deja de enviar el Bearer", paquete: "web", archivo: "apps/web/src/api/client.js", de: "...(token ? { Authorization: `Bearer ${token}` } : {}),", a: "", tests: ["src/api/client.test.js"] },
    { regla: "Web: cola offline sigue sin red (break → continue)", paquete: "web", archivo: "apps/web/src/lib/offline-sync.js", de: "break;", a: "continue;", tests: ["src/lib/offline-sync.test.js"] },
    { regla: "Web: la cola offline pierde la clave de idempotencia", paquete: "web", archivo: "apps/web/src/lib/offline-sync.js", de: 'api.post("/health-events", item.datos)', a: 'api.post("/health-events", { ...item.datos, claveIdempotencia: crypto.randomUUID() })', tests: ["src/lib/offline-sync.test.js"] },
];

let restauraciones = [];
const restaurar = () => { for (const r of restauraciones.splice(0)) writeFileSync(r.ruta, r.contenido); };
process.on("SIGINT", () => { restaurar(); process.exit(130); });
process.on("exit", restaurar);

let sobrevivientes = 0;
for (const m of MUTACIONES) {
    const ruta = path.join(raiz, m.archivo);
    const original = readFileSync(ruta, "utf8");
    if (original.split(m.de).length - 1 !== 1) {
        console.log(`?  ${m.regla}\n   el texto a mutar ya no aparece exactamente una vez en ${m.archivo}: actualiza este script`);
        sobrevivientes++;
        continue;
    }
    restauraciones.push({ ruta, contenido: original });
    writeFileSync(ruta, original.replace(m.de, m.a));
    const resultado = spawnSync("pnpm", ["--filter", `@hcm/${m.paquete}`, "exec", "vitest", "run", ...m.tests], { cwd: raiz, encoding: "utf8" });
    restaurar();
    const detectada = resultado.status !== 0;
    if (!detectada) sobrevivientes++;
    console.log(`${detectada ? "✔ detectada " : "✘ SOBREVIVIÓ"}  ${m.regla}`);
}
console.log(sobrevivientes === 0 ? `\nLas ${MUTACIONES.length} mutaciones fueron detectadas.` : `\n${sobrevivientes} mutación(es) sin detectar: hay reglas sin protección.`);
process.exit(sobrevivientes === 0 ? 0 : 1);
