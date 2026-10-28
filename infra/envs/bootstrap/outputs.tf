output "nombre_bucket_estado" {
  description = "Bucket para el backend de dev y prod (backend.hcl: bucket)."
  value       = module.estado.nombre_bucket_estado
}

output "nombre_tabla_bloqueo" {
  description = "Tabla para el backend de dev y prod (backend.hcl: dynamodb_table)."
  value       = module.estado.nombre_tabla_bloqueo
}

output "arn_rol_plan" {
  description = "Valor de la variable de GitHub AWS_PLAN_ROLE_ARN."
  value       = module.github_oidc.arn_rol_plan
}

output "arn_rol_apply" {
  description = "Valor de la variable de GitHub AWS_APPLY_ROLE_ARN."
  value       = module.github_oidc.arn_rol_apply
}
