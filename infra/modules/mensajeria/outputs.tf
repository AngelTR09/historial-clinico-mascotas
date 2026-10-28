output "arns_colas" {
  description = "ARN de cada cola, por nombre."
  value       = { for nombre, cola in aws_sqs_queue.cola : nombre => cola.arn }
}

output "urls_colas" {
  description = "URL de cada cola, por nombre."
  value       = { for nombre, cola in aws_sqs_queue.cola : nombre => cola.url }
}

output "nombres_colas" {
  description = "Nombre de cada cola, por nombre lógico (para las alarmas)."
  value       = { for nombre, cola in aws_sqs_queue.cola : nombre => cola.name }
}

output "nombres_colas_fallidos" {
  description = "Nombre de cada DLQ, por nombre lógico (para las alarmas)."
  value       = { for nombre, cola in aws_sqs_queue.fallidos : nombre => cola.name }
}

output "arn_tema_alertas" {
  description = "ARN del tema SNS de alertas operativas."
  value       = aws_sns_topic.alertas.arn
}

output "arn_tema_recordatorios" {
  description = "ARN del tema SNS de recordatorios a dueños."
  value       = aws_sns_topic.recordatorios.arn
}

output "arns_identidades_ses" {
  description = "ARN de cada identidad verificada en SES (remitente y destinatarios de prueba)."
  value       = [for identidad in aws_sesv2_email_identity.correo : identidad.arn]
}
