output "nombre_presupuesto_mensual" {
  description = "Nombre del presupuesto mensual."
  value       = aws_budgets_budget.mensual.name
}

output "nombre_presupuesto_creditos" {
  description = "Nombre del presupuesto de créditos totales."
  value       = aws_budgets_budget.creditos.name
}
