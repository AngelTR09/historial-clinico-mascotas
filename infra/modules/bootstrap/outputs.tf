output "nombre_bucket_estado" {
  description = "Nombre del bucket S3 que guarda el estado de Terraform."
  value       = aws_s3_bucket.estado.id
}

output "arn_bucket_estado" {
  description = "ARN del bucket de estado."
  value       = aws_s3_bucket.estado.arn
}

output "nombre_tabla_bloqueo" {
  description = "Nombre de la tabla DynamoDB de bloqueo."
  value       = aws_dynamodb_table.bloqueo.name
}

output "arn_tabla_bloqueo" {
  description = "ARN de la tabla DynamoDB de bloqueo."
  value       = aws_dynamodb_table.bloqueo.arn
}

output "arn_clave_estado" {
  description = "ARN de la clave KMS que cifra el estado."
  value       = aws_kms_key.estado.arn
}
