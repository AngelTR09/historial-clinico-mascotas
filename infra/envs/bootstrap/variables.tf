variable "region" {
  type        = string
  description = "Región de AWS (el diagrama de arquitectura usa us-east-1)."
  default     = "us-east-1"
}

variable "nombre_proyecto" {
  type        = string
  description = "Prefijo de los recursos del proyecto."
  default     = "hcm"
}

variable "owner" {
  type        = string
  description = "Responsable del entorno; va en la etiqueta Owner."
}

variable "correos_alerta" {
  type        = list(string)
  description = "Correos que reciben las alertas de presupuesto."
}

variable "repositorio_github" {
  type        = string
  description = "Repositorio autorizado a asumir los roles OIDC (dueño/nombre)."
  default     = "AngelTR09/historial-clinico-mascotas"
}

variable "arn_monitor_anomalias_existente" {
  type        = string
  description = "ARN del monitor de anomalías de costo que la cuenta ya tiene (AWS crea uno por defecto). Se obtiene con: aws ce get-anomaly-monitors. Vacío: se crea uno."
  default     = ""
}

variable "crear_proveedor_oidc" {
  type        = bool
  description = "Crear el proveedor OIDC de GitHub; false si la cuenta ya tiene uno."
  default     = true
}
