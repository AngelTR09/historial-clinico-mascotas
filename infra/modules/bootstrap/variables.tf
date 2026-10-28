variable "nombre_proyecto" {
  type        = string
  description = "Prefijo de los recursos de estado (bucket y tabla de bloqueo)."
  default     = "hcm"
}

variable "etiquetas_comunes" {
  type        = map(string)
  description = "Etiquetas obligatorias del proyecto (Project, Env, Owner)."
  default     = {}
}

variable "dias_retencion_versiones_antiguas" {
  type        = number
  description = "Días que se conservan las versiones no vigentes del estado antes de expirar."
  default     = 90

  validation {
    condition     = var.dias_retencion_versiones_antiguas >= 30
    error_message = "Conservar al menos 30 días de versiones del estado para poder recuperarlo."
  }
}
