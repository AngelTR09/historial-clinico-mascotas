output "dominio_cloudfront" {
  description = "Dominio HTTPS de la web y la API."
  value       = aws_cloudfront_distribution.principal.domain_name
}

output "id_distribucion" {
  description = "ID de la distribución (para invalidar la caché en el despliegue)."
  value       = aws_cloudfront_distribution.principal.id
}

output "nombre_bucket_web" {
  description = "Bucket donde el despliegue sube el build de Vite."
  value       = aws_s3_bucket.web.id
}
