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

variable "proteccion_contra_borrado" {
  type        = string
  description = "ACTIVE en prod; INACTIVE en dev para poder hacer destroy."
  default     = "ACTIVE"

  validation {
    condition     = contains(["ACTIVE", "INACTIVE"], var.proteccion_contra_borrado)
    error_message = "Usar ACTIVE o INACTIVE."
  }
}

variable "grupos" {
  type        = map(string)
  description = "Grupos de usuarios (nombre => descripción). El rol de cada persona sale del grupo."
  default = {
    duenos       = "Propietarios de mascotas"
    veterinarios = "Veterinarios aprobados"
    albergues    = "Albergues y asociaciones de rescate"
  }
}
