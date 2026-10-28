import { eq } from "drizzle-orm";
import { registrarAuditoria } from "../audit/record-audit.js";
import { db } from "../db/client.js";
import { duenos } from "../db/schema.js";
import { registrarMascota } from "../use-cases/pets/register-pet.js";
/**
 * Consumidor local del tópico 'bulk-pet-upload' (PuertoCola). A diferencia
 * de la camada, procesa cada mascota por separado — nunca en una sola
 * transacción del lote completo: a 100 expedientes, sostener una
 * transacción tan larga sería justo el problema que la sección 12
 * advierte evitar ("no bloquear las escrituras del resto"). Un fallo en
 * una mascota no aborta el resto: se registra y se sigue. Reutiliza
 * `registrarMascota` tal cual, ya que aquí no hace falta compartir una
 * transacción entre inserciones.
 */
export function registrarTrabajadorCargaMasivaMascotas(ports) {
    ports.cola.subscribe("bulk-pet-upload", async (trabajo) => {
        let exitosas = 0;
        let fallidas = 0;
        for (const input of trabajo.mascotas) {
            try {
                const mascota = await registrarMascota(ports, trabajo.idDueno, input);
                await registrarAuditoria({ tipoActor: "dueno", idActor: trabajo.idDueno, idMascota: mascota.id, accion: "crear_mascota", ip: "0.0.0.0" });
                exitosas++;
            }
            catch (err) {
                fallidas++;
                console.error(`[bulk-pet-upload] fallo creando una mascota para el dueño ${trabajo.idDueno}:`, err);
            }
        }
        const [dueno] = await db.select({ correo: duenos.correo }).from(duenos).where(eq(duenos.id, trabajo.idDueno)).limit(1);
        if (dueno) {
            await ports.notificacion.notify({
                to: dueno.correo,
                template: "carga_masiva_completada",
                data: { total: trabajo.mascotas.length, exitosas, fallidas },
            });
        }
    });
}
