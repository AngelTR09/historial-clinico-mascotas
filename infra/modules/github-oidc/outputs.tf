output "arn_rol_plan" {
  description = "ARN del rol de solo lectura para terraform plan en pull requests."
  value       = aws_iam_role.plan.arn
}

output "arn_rol_apply" {
  description = "ARN del rol de terraform apply, limitado a la rama protegida."
  value       = aws_iam_role.apply.arn
}
