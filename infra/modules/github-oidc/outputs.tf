output "arn_rol_plan" {
  description = "ARN del rol de solo lectura para terraform plan en pull requests (variable de GitHub AWS_PLAN_ROLE_ARN)."
  value       = aws_iam_role.plan.arn
}

output "arn_rol_despliegue" {
  description = "ARN del rol de despliegue, que solo asume un job con el environment dev (variable de GitHub AWS_ROLE_ARN)."
  value       = aws_iam_role.despliegue.arn
}
