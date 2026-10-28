import { TEMA_RECORDATORIO } from "../domain/temas-cola.js";
/**
 * Consumidor del tema 'reminder' (PuertoCola): entrega cada recordatorio por
 * `NotifyPort`. Si la entrega falla, el manejador lanza y la cola lo reintenta;
 * agotados los intentos el mensaje queda en la DLQ y nunca se pierde (RNF 18).
 * En la nube este mismo cuerpo corre como la Lambda `notificador`, alimentada
 * por SQS y fuera de la VPC (solo habla con SNS y SES).
 */
export function registrarTrabajadorNotificador(ports) {
    ports.cola.subscribe(TEMA_RECORDATORIO, async (recordatorio) => {
        await ports.notificacion.notify({
            to: recordatorio.to,
            template: "recordatorio_vencimiento_vacuna",
            data: {
                nombreMascota: recordatorio.nombreMascota,
                vacuna: recordatorio.vacuna,
                // Los mensajes encolados antes de que existiera `tipo` siguen siendo vacunas.
                tipo: recordatorio.tipo ?? "vacuna",
                vencimiento: recordatorio.vencimiento,
            },
        });
    });
}
