output "nombre_boveda" {
  description = "Nombre de la bóveda de respaldos."
  value       = aws_backup_vault.principal.name
}
