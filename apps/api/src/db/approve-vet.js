import "../env.js";
import { and, eq } from "drizzle-orm";
import { db } from "./client.js";
import { veterinarios } from "./schema.js";
/**
 * Solo para desarrollo local: aprueba una cuenta de veterinario, que nace
 * 'pendiente' porque su licencia no se verifica contra ningún servicio.
 * Sin argumentos lista las cuentas pendientes. Un mismo número de licencia
 * puede repetirse entre países, por eso se identifica con país + número.
 *
 *   pnpm --filter @hcm/api db:aprobar-vet PE CMVP-12345
 */
const [pais, numeroLicencia] = process.argv.slice(2);
if (!pais || !numeroLicencia) {
    const pendientes = await db.select().from(veterinarios).where(eq(veterinarios.estado, "pendiente"));
    if (pendientes.length === 0) {
        console.log("No hay veterinarios pendientes.");
    }
    for (const veterinario of pendientes) {
        console.log(`${veterinario.pais}\t${veterinario.autoridadEmisora}\t${veterinario.numeroLicencia}\t${veterinario.id}`);
    }
    process.exit(0);
}
const aprobados = await db
    .update(veterinarios)
    .set({ estado: "aprobado", verificadoEn: new Date() })
    .where(and(eq(veterinarios.pais, pais.toUpperCase()), eq(veterinarios.numeroLicencia, numeroLicencia)))
    .returning({ id: veterinarios.id });
if (aprobados.length === 0) {
    console.error(`No existe un veterinario con licencia ${numeroLicencia} en ${pais.toUpperCase()}.`);
    process.exit(1);
}
console.log(`Aprobado: ${pais.toUpperCase()} ${numeroLicencia} (${aprobados.length} cuenta${aprobados.length === 1 ? "" : "s"}).`);
process.exit(0);
