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

variable "id_vpc" {
  type        = string
  description = "ID de la VPC."
}

variable "ids_subredes_publicas" {
  type        = list(string)
  description = "Subredes públicas (una por zona) para el ALB y las tareas."
}

variable "id_sg_alb" {
  type        = string
  description = "Grupo de seguridad del ALB."
}

variable "id_sg_api" {
  type        = string
  description = "Grupo de seguridad de las tareas de la API."
}

variable "arn_clave_datos" {
  type        = string
  description = "ARN de la clave KMS de datos (logs, ECR y descifrado de secretos)."
}

variable "etiqueta_imagen" {
  type        = string
  description = "Etiqueta de la imagen de la API en ECR (el CI usa el SHA del commit; las etiquetas son inmutables)."
  default     = "inicial"
}

variable "arquitectura" {
  type        = string
  description = "Arquitectura de la imagen: la que construye el runner de GitHub (X86_64) o ARM64."
  default     = "X86_64"

  validation {
    condition     = contains(["X86_64", "ARM64"], var.arquitectura)
    error_message = "Usar X86_64 o ARM64."
  }
}

variable "cpu" {
  type        = number
  description = "Unidades de CPU de la tarea Fargate."
  default     = 256
}

variable "memoria" {
  type        = number
  description = "Memoria de la tarea Fargate en MiB."
  default     = 512
}

variable "tareas_minimas" {
  type        = number
  description = "Mínimo de tareas. 2 (una por zona) en exposición y pruebas para cumplir RNF 08 y 11; 1 el resto del tiempo."
  default     = 1

  validation {
    condition     = var.tareas_minimas >= 1
    error_message = "Debe haber al menos una tarea."
  }
}

variable "tareas_maximas" {
  type        = number
  description = "Máximo de tareas del autoescalado."
  default     = 4
}

variable "solicitudes_por_tarea" {
  type        = number
  description = "Solicitudes por tarea que disparan el escalado (RNF 10)."
  default     = 200
}

variable "proteccion_alb" {
  type        = bool
  description = "deletion_protection del ALB. true en prod, false en dev."
  default     = true
}

variable "dias_logs" {
  type        = number
  description = "Días de retención de los logs de la API."
  default     = 365
}

variable "variables_entorno" {
  type        = map(string)
  description = "Variables de entorno NO secretas de la API (nombre => valor)."
  default     = {}
}

variable "secretos_entorno" {
  type        = map(string)
  description = "Secretos como variables de entorno (nombre => ARN del secreto, con :clave:: para un campo JSON)."
  default     = {}
}

variable "arn_bucket_evidencias" {
  type        = string
  description = "Bucket de evidencias al que la API firma URLs de subida."
}

variable "arns_tablas_dynamodb" {
  type        = list(string)
  description = "Tablas DynamoDB que la API lee y escribe."
}

variable "arns_colas" {
  type        = list(string)
  description = "Colas SQS a las que la API envía mensajes."
}

variable "arns_identidades_ses" {
  type        = list(string)
  description = "Identidades de SES desde las que la API envía el código de verificación del login."
  default     = []
}

variable "arns_temas_sns" {
  type        = list(string)
  description = "Temas SNS en los que la API publica notificaciones."
  default     = []
}

variable "arns_secretos" {
  type        = list(string)
  description = "Secretos que la tarea puede leer."
}
