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

variable "arn_tema_alertas" {
  type        = string
  description = "Tema SNS que avisa al responsable (llega por correo en menos de 1 minuto)."
}

variable "sufijo_arn_alb" {
  type        = string
  description = "Sufijo del ARN del ALB (dimensión LoadBalancer)."
}

variable "sufijo_arn_grupo_destino" {
  type        = string
  description = "Sufijo del ARN del grupo destino (dimensión TargetGroup)."
}

variable "identificador_rds" {
  type        = string
  description = "Identificador de la instancia RDS."
}

variable "nombres_colas" {
  type        = map(string)
  description = "Nombre de cada cola SQS, por nombre lógico."
}

variable "nombres_colas_fallidos" {
  type        = map(string)
  description = "Nombre de cada DLQ, por nombre lógico."
}

variable "umbral_cola" {
  type        = number
  description = "Mensajes en cola que disparan la alerta (documentación del proyecto §10: 5 000)."
  default     = 5000
}

variable "umbral_error_porcentaje" {
  type        = number
  description = "Porcentaje de respuestas 5xx que dispara la alerta (documentación del proyecto §10: 1 %)."
  default     = 1
}

variable "umbral_latencia_segundos" {
  type        = number
  description = "Latencia p95 que dispara la alerta (RNF 07 y 10: 2 s)."
  default     = 2
}
