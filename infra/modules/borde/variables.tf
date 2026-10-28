variable "nombre_proyecto" {
  type        = string
  description = "Prefijo de los recursos."
  default     = "hcm"
}

variable "etiquetas_comunes" {
  type        = map(string)
  description = "Etiquetas obligatorias del proyecto (Project, Env, Owner)."
  default     = {}
}

variable "dns_alb" {
  type        = string
  description = "DNS del ALB, origen de la API."
}

variable "nombre_bucket_evidencias" {
  type        = string
  description = "Bucket de evidencias: se le agrega CORS para subir desde el dominio de CloudFront."
}

variable "arn_waf" {
  type        = string
  description = "ARN del WebACL de WAF. null mientras WAF esté diferido (solo en la demostración de seguridad)."
  default     = null
}

variable "clase_de_precio" {
  type        = string
  description = "Clase de precio de CloudFront."
  default     = "PriceClass_100"
}

variable "forzar_borrado" {
  type        = bool
  description = "Permite que terraform destroy borre el bucket de la web aunque tenga contenido. Solo true en dev (sin él el destroy falla); en prod siempre false y una política OPA lo impide."
  default     = false
}
