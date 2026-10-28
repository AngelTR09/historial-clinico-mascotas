import { buscarRecordatoriosVencidos } from "./find-due-reminders.js";
/** Lo que ve el dueño en su dashboard: solo sus propias mascotas, nunca las de otro dueño. */
export async function listarRecordatoriosDueno(idDueno) {
    const vencidos = await buscarRecordatoriosVencidos(new Date(), idDueno);
    return vencidos.map((recordatorio) => ({
        idMascota: recordatorio.idMascota,
        nombreMascota: recordatorio.nombreMascota,
        vacuna: recordatorio.nombreCanonico,
        tipo: recordatorio.tipo,
        vencimiento: recordatorio.dueDate.toISOString().slice(0, 10),
    }));
}
