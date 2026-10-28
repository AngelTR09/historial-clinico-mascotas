output "id_grupo_usuarios" {
  description = "ID del user pool de Cognito."
  value       = aws_cognito_user_pool.principal.id
}

output "arn_grupo_usuarios" {
  description = "ARN del user pool de Cognito."
  value       = aws_cognito_user_pool.principal.arn
}

output "id_cliente_web" {
  description = "ID del cliente de la app web."
  value       = aws_cognito_user_pool_client.web.id
}

output "emisor" {
  description = "Emisor (issuer) de los tokens, para que la API los valide."
  value       = aws_cognito_user_pool.principal.endpoint
}
