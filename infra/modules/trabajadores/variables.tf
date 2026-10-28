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

variable "ids_subredes_privadas" {
  type        = list(string)
  description = "Subredes privadas para las Lambdas que leen RDS."
}

variable "id_sg_funciones" {
  type        = string
  description = "Grupo de seguridad de las Lambdas dentro de la VPC."
}

variable "arn_clave_datos" {
  type        = string
  description = "ARN de la clave KMS de datos (logs y variables de entorno)."
}

variable "directorio_paquetes" {
  type        = string
  description = "Carpeta con los .zip de cada función. Los construye `pnpm trabajadores:empaquetar` desde apps/api/src/lambdas/."
  default     = "../../../workers/dist"
}

variable "arns_colas" {
  type        = map(string)
  description = "ARN de las colas SQS por nombre lógico (proyeccion, normalizacion, recordatorios)."
}

variable "urls_colas" {
  type        = map(string)
  description = "URL de las colas SQS por nombre lógico."
}

variable "arn_tabla_perfil_publico" {
  type        = string
  description = "ARN de la tabla DynamoDB de la ficha pública (la escribe el proyector)."
}

variable "nombre_tabla_perfil_publico" {
  type        = string
  description = "Nombre de la tabla DynamoDB de la ficha pública."
}

variable "arn_secreto_bd" {
  type        = string
  description = "ARN del secreto de RDS con usuario y contraseña."
}

variable "direccion_rds" {
  type        = string
  description = "Host de la base de datos."
}

variable "arns_identidades_ses" {
  type        = list(string)
  description = "ARN de las identidades de SES (remitente y destinatarios de prueba) desde las que el notificador puede enviar."

  validation {
    condition     = length(var.arns_identidades_ses) > 0
    error_message = "El notificador necesita al menos una identidad de SES: sin remitente verificado no sale ningún correo."
  }
}

variable "correo_remitente" {
  type        = string
  description = "Correo remitente de los recordatorios (identidad verificada en SES)."
}

variable "cron_recordatorios" {
  type        = string
  description = "Cuándo corre el barrido diario de recordatorios (UTC). 13:00 UTC = 08:00 en Lima."
  default     = "cron(0 13 * * ? *)"
}

variable "dias_logs" {
  type        = number
  description = "Días de retención de los logs."
  default     = 365
}

variable "variables_entorno" {
  type        = map(string)
  description = "Variables de entorno NO secretas comunes a todas las funciones."
  default     = {}
}
