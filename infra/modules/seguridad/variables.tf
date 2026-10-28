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

variable "dias_recuperacion_secretos" {
  type        = number
  description = "Días que un secreto borrado puede recuperarse (0 = borrado inmediato, solo para dev)."
  default     = 7

  validation {
    condition     = var.dias_recuperacion_secretos == 0 || (var.dias_recuperacion_secretos >= 7 && var.dias_recuperacion_secretos <= 30)
    error_message = "Usar 0 o un valor entre 7 y 30."
  }
}

variable "parametros" {
  type        = map(string)
  description = "Configuración NO secreta de la API para Parameter Store (nombre => valor), p. ej. OCR_ENABLED."
  default     = {}
}
