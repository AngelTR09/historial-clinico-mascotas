variable "region" {
  type        = string
  description = "Región de AWS (el diagrama de arquitectura usa us-east-1)."
  default     = "us-east-1"
}

variable "owner" {
  type        = string
  description = "Responsable del entorno; va en la etiqueta Owner."
}

variable "correos_alerta" {
  type        = list(string)
  description = "Correos que reciben las alertas operativas (CloudWatch vía SNS)."
}

variable "multi_az" {
  type        = bool
  description = "Réplica de RDS en otra zona. Encender solo en exposición y pruebas (RNF 05 y 11): duplica el costo de la base."
  default     = false
}

variable "tareas_minimas" {
  type        = number
  description = "Mínimo de tareas de la API. 2 (una por zona) en exposición y pruebas (RNF 08); 1 el resto del tiempo."
  default     = 1
}

variable "etiqueta_imagen" {
  type        = string
  description = "Etiqueta de la imagen de la API en ECR; el despliegue pasa el SHA del commit."
  default     = "inicial"
}

variable "correo_remitente" {
  type        = string
  description = "Correo desde el que SES envía los códigos de login y los recordatorios. Se verifica en SES: AWS le manda un enlace que hay que abrir."

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.correo_remitente))
    error_message = "correo_remitente debe ser un correo válido."
  }
}

variable "correos_ses_prueba" {
  type        = list(string)
  description = "Destinatarios que también se verifican en SES. Solo hacen falta mientras la cuenta esté en sandbox."
  default     = []
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
