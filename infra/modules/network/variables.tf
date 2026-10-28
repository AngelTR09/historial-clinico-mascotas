variable "nombre_proyecto" {
  type        = string
  description = "Prefijo de los recursos de red."
  default     = "hcm"
}

variable "etiquetas_comunes" {
  type        = map(string)
  description = "Etiquetas obligatorias del proyecto (Project, Env, Owner)."
  default     = {}
}

variable "cidr_vpc" {
  type        = string
  description = "Rango de direcciones de la VPC."
  default     = "10.0.0.0/16"
}

variable "zonas" {
  type        = list(string)
  description = "Zonas de disponibilidad. Vacío: <región>a y <región>b. El PDF exige dos (RNF 08 y 11)."
  default     = []

  validation {
    condition     = length(var.zonas) == 0 || length(var.zonas) >= 2
    error_message = "Se necesitan al menos dos zonas de disponibilidad (RNF 08 y 11)."
  }
}

variable "endpoints_interfaz" {
  type        = set(string)
  description = "Servicios con endpoint de interfaz para las Lambdas en subred privada (sin NAT no llegan a internet). secretsmanager: leer la contraseña de RDS; sqs: la Lambda de recordatorios encola. Cada uno cuesta ~USD 0,01 por hora y zona mientras exista."
  default     = ["secretsmanager", "sqs"]
}
