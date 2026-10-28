# Lo que necesitan los workflows de despliegue (Pendiente_Integrar/github-actions/GITHUB-ACTIONS.md) y las personas que
# operan el entorno. Ninguna salida contiene secretos.

output "dominio_cloudfront" {
  description = "Dirección pública de la aplicación (web y /api)."
  value       = module.borde.dominio_cloudfront
}

output "id_distribucion" {
  description = "Distribución de CloudFront a invalidar tras publicar la web."
  value       = module.borde.id_distribucion
}

output "nombre_bucket_web" {
  description = "Bucket de la web estática (destino del build de Vite)."
  value       = module.borde.nombre_bucket_web
}

output "url_repositorio_ecr" {
  description = "Repositorio donde se sube la imagen de la API."
  value       = module.computo.url_repositorio_ecr
}

output "nombre_cluster" {
  description = "Clúster de ECS de la API."
  value       = module.computo.nombre_cluster
}

output "nombre_servicio" {
  description = "Servicio de ECS de la API."
  value       = module.computo.nombre_servicio
}
