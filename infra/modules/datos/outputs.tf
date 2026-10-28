output "identificador_rds" {
  description = "Identificador de la instancia RDS."
  value       = aws_db_instance.principal.identifier
}

output "arn_rds" {
  description = "ARN de la instancia RDS."
  value       = aws_db_instance.principal.arn
}

output "direccion_rds" {
  description = "Host de la base de datos."
  value       = aws_db_instance.principal.address
}

output "arn_secreto_bd" {
  description = "ARN del secreto con usuario y contraseña que RDS administra."
  value       = aws_db_instance.principal.master_user_secret[0].secret_arn
}

output "arn_tabla_perfil_publico" {
  description = "ARN de la tabla DynamoDB de la ficha pública."
  value       = aws_dynamodb_table.perfil_publico.arn
}

output "nombre_tabla_perfil_publico" {
  description = "Nombre de la tabla DynamoDB de la ficha pública."
  value       = aws_dynamodb_table.perfil_publico.name
}

output "nombre_bucket_evidencias" {
  description = "Nombre del bucket de evidencias."
  value       = aws_s3_bucket.evidencias.id
}

output "arn_bucket_evidencias" {
  description = "ARN del bucket de evidencias."
  value       = aws_s3_bucket.evidencias.arn
}
