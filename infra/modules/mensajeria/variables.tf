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
  description = "ARN de la clave KMS que cifra los temas SNS (las alarmas de CloudWatch lo exigen propia)."
}

variable "correos_alerta" {
  type        = list(string)
  description = "Correos suscritos al tema de alertas operativas."
}

variable "visibilidad_segundos" {
  type        = number
  description = "Tiempo de visibilidad de las colas; debe superar el timeout de la Lambda consumidora."
  default     = 720
}

variable "maximo_recepciones" {
  type        = number
  description = "Intentos antes de que un mensaje pase a la DLQ (plan de migración: 3)."
  default     = 3
}

variable "correo_remitente" {
  type        = string
  description = "Correo desde el que SES envía los códigos de login y los recordatorios. Se verifica como identidad de SES."
  default     = ""
}

variable "correos_ses_prueba" {
  type        = list(string)
  description = "Destinatarios que también se verifican en SES. Solo hacen falta mientras la cuenta esté en sandbox (SES solo entrega a identidades verificadas)."
  default     = []
}
