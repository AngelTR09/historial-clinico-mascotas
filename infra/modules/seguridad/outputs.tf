output "arn_clave_datos" {
  description = "ARN de la clave KMS de datos."
  value       = aws_kms_key.datos.arn
}

output "arns_secretos_api" {
  description = "ARN de cada secreto de la API, por nombre (doc-encryption-key, doc-hmac-pepper, firma-acceso-vet)."
  value       = { for nombre, secreto in aws_secretsmanager_secret.api : nombre => secreto.arn }
}

output "nombres_parametros" {
  description = "Nombres de los parámetros de configuración en Parameter Store."
  value       = [for p in aws_ssm_parameter.configuracion : p.name]
}
