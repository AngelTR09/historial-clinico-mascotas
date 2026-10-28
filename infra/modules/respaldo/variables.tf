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

variable "arn_clave_datos" {
  type        = string
  description = "ARN de la clave KMS que cifra la bóveda de respaldos."
}

variable "arns_recursos" {
  type        = list(string)
  description = "Recursos a respaldar (la instancia RDS)."
}

variable "dias_retencion" {
  type        = number
  description = "Días que se conservan los respaldos (máximo 35 con respaldo continuo)."
  default     = 35

  validation {
    condition     = var.dias_retencion >= 1 && var.dias_retencion <= 35
    error_message = "El respaldo continuo admite entre 1 y 35 días."
  }
}
