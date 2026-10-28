variable "nombre_proyecto" {
  type        = string
  description = "Prefijo de los nombres de presupuesto."
  default     = "hcm"
}

variable "correos_alerta" {
  type        = list(string)
  description = "Correos que reciben las alertas de presupuesto y de anomalías de costo."

  validation {
    condition     = length(var.correos_alerta) > 0
    error_message = "Debe haber al menos un correo de alerta: sin destinatario, el presupuesto no protege nada."
  }
}

variable "limite_mensual_usd" {
  type        = number
  description = "Costo mensual objetivo en USD (presupuesto del curso)."
  default     = 35
}

variable "limite_creditos_usd" {
  type        = number
  description = "Tope total de créditos AWS en USD (presupuesto duro del curso)."
  default     = 200
}

variable "umbral_anomalia_usd" {
  type        = number
  description = "Impacto absoluto en USD a partir del cual se avisa de una anomalía de costo."
  default     = 5
}

variable "arn_monitor_anomalias_existente" {
  type        = string
  description = "ARN del monitor de anomalías de servicios que la cuenta ya tiene (AWS crea uno por defecto y solo admite uno). Vacío: el módulo crea el suyo."
  default     = ""

  validation {
    condition     = var.arn_monitor_anomalias_existente == "" || can(regex("^arn:aws:ce::[0-9]{12}:anomalymonitor/[0-9a-f-]+$", var.arn_monitor_anomalias_existente))
    error_message = "Debe ser el ARN de un monitor (arn:aws:ce::<cuenta>:anomalymonitor/<id>) o quedar vacío."
  }
}

variable "etiquetas_comunes" {
  type        = map(string)
  description = "Etiquetas obligatorias del proyecto (Project, Env, Owner)."
  default     = {}
}
