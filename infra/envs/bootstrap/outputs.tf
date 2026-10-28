output "nombre_bucket_estado" {
  description = "Valor de la variable de GitHub TF_STATE_BUCKET y de bucket en backend.hcl."
  value       = module.estado.nombre_bucket_estado
}

output "arn_rol_plan" {
  description = "Valor de la variable de GitHub AWS_PLAN_ROLE_ARN."
  value       = module.github_oidc.arn_rol_plan
}

output "arn_rol_despliegue" {
  description = "Valor de la variable de GitHub AWS_ROLE_ARN (rol que solo asume el environment dev)."
  value       = module.github_oidc.arn_rol_despliegue
}

output "arn_clave_estado" {
  description = "Valor de kms_key_id en backend.hcl: con él el estado se cifra con la clave propia y no con la de S3."
  value       = module.estado.arn_clave_estado
}
