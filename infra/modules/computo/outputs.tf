output "dns_alb" {
  description = "DNS del ALB, origen de la API para CloudFront."
  value       = aws_lb.api.dns_name
}

output "sufijo_arn_alb" {
  description = "Sufijo del ARN del ALB (dimensión LoadBalancer de las métricas)."
  value       = aws_lb.api.arn_suffix
}

output "sufijo_arn_grupo_destino" {
  description = "Sufijo del ARN del grupo destino (dimensión TargetGroup de las métricas)."
  value       = aws_lb_target_group.api.arn_suffix
}

output "nombre_cluster" {
  description = "Nombre del cluster ECS."
  value       = aws_ecs_cluster.principal.name
}

output "nombre_servicio" {
  description = "Nombre del servicio ECS de la API."
  value       = aws_ecs_service.api.name
}

output "url_repositorio_ecr" {
  description = "URL del repositorio ECR de la imagen de la API."
  value       = aws_ecr_repository.api.repository_url
}

output "familia_tarea" {
  description = "Familia de la definición de tarea (para el despliegue)."
  value       = aws_ecs_task_definition.api.family
}
