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

variable "prefijo_sub_github" {
  type        = string
  description = "Prefijo del claim sub de GitHub para el repositorio (con identificador inmutable). Obtenerlo con: gh api repos/<dueño>/<repo>/actions/oidc/customization/sub --jq .sub_claim_prefix. Vacío: repo:<repositorio_github>."
  default     = ""
}

variable "crear_proveedor_oidc" {
  type        = bool
  description = "Crear el proveedor OIDC de GitHub; false si la cuenta ya tiene uno."
  default     = true
}

variable "ids_cuentas_permitidas" {
  type        = list(string)
  description = "Cuentas de AWS contra las que se permite operar; Terraform se niega a seguir en cualquier otra. Vacía: sin restricción (CI la llena con la variable AWS_ACCOUNT_ID)."
  default     = []

  validation {
    condition     = alltrue([for id in var.ids_cuentas_permitidas : can(regex("^[0-9]{12}$", id))])
    error_message = "Cada cuenta debe ser un identificador de 12 dígitos."
  }
}
