output "nombres_funciones" {
  description = "Nombre de cada función Lambda, por nombre lógico (para el despliegue)."
  value       = { for k, f in aws_lambda_function.funcion : k => f.function_name }
}

output "nombre_cola_fallidos_lambda" {
  description = "Nombre de la DLQ de invocaciones asíncronas (para las alarmas)."
  value       = aws_sqs_queue.fallidos_lambda.name
}
