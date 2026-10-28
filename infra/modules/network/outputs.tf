output "id_vpc" {
  description = "ID de la VPC."
  value       = aws_vpc.principal.id
}

output "ids_subredes_publicas" {
  description = "Subredes públicas (ALB y tareas Fargate), una por zona."
  value       = aws_subnet.publica[*].id
}

output "ids_subredes_privadas" {
  description = "Subredes privadas (RDS y Lambdas), una por zona."
  value       = aws_subnet.privada[*].id
}

output "id_sg_alb" {
  description = "Grupo de seguridad del ALB."
  value       = aws_security_group.alb.id
}

output "id_sg_api" {
  description = "Grupo de seguridad de las tareas de la API."
  value       = aws_security_group.api.id
}

output "id_sg_db" {
  description = "Grupo de seguridad de RDS."
  value       = aws_security_group.db.id
}

output "id_sg_funciones" {
  description = "Grupo de seguridad de las Lambdas dentro de la VPC."
  value       = aws_security_group.funciones.id
}
