output "nombres_alarmas" {
  description = "Nombre de todas las alarmas creadas."
  value = concat(
    [
      aws_cloudwatch_metric_alarm.errores_5xx.alarm_name,
      aws_cloudwatch_metric_alarm.latencia_p95.alarm_name,
      aws_cloudwatch_metric_alarm.tarea_no_saludable.alarm_name,
      aws_cloudwatch_metric_alarm.rds_cpu.alarm_name,
      aws_cloudwatch_metric_alarm.rds_almacenamiento.alarm_name,
    ],
    [for a in aws_cloudwatch_metric_alarm.cola_saturada : a.alarm_name],
    [for a in aws_cloudwatch_metric_alarm.mensaje_en_dlq : a.alarm_name],
  )
}
