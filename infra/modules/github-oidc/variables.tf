variable "nombre_proyecto" {
  type        = string
  description = "Prefijo de los roles."
  default     = "hcm"
}

variable "repositorio_github" {
  type        = string
  description = "Repositorio autorizado, con formato dueño/nombre."

  validation {
    condition     = can(regex("^[A-Za-z0-9-_.]+/[A-Za-z0-9-_.]+$", var.repositorio_github))
    error_message = "Usar el formato dueño/nombre, por ejemplo AngelTR09/historial-clinico-mascotas."
  }
}

variable "rama_apply" {
  type        = string
  description = "Única rama desde la que se permite terraform apply."
  default     = "main"
}

variable "entornos_apply" {
  type        = list(string)
  description = "Environments de GitHub cuyos jobs pueden asumir el rol de apply. Cada uno debe tener en GitHub (Settings > Environments) la rama main como única rama de despliegue y, en prod, revisores obligatorios: AWS solo ve el nombre del environment, no la rama."
  default     = ["aws-dev", "aws-prod"]

  validation {
    condition     = alltrue([for e in var.entornos_apply : can(regex("^[A-Za-z0-9._-]+$", e))])
    error_message = "Los nombres de environment solo pueden llevar letras, números, punto, guion y guion bajo (sin comodines)."
  }
}

variable "entornos_plan" {
  type        = list(string)
  description = "Environments de GitHub cuyos jobs pueden asumir el rol de plan (solo lectura), p. ej. la prueba de carga contra AWS."
  default     = ["aws-dev"]

  validation {
    condition     = alltrue([for e in var.entornos_plan : can(regex("^[A-Za-z0-9._-]+$", e))])
    error_message = "Los nombres de environment solo pueden llevar letras, números, punto, guion y guion bajo (sin comodines)."
  }
}

variable "crear_proveedor_oidc" {
  type        = bool
  description = "Crear el proveedor OIDC de GitHub. Una cuenta solo admite uno: ponerlo en false si ya existe."
  default     = true
}

variable "arn_bucket_estado" {
  type        = string
  description = "ARN del bucket de estado de Terraform."
}

variable "arn_tabla_bloqueo" {
  type        = string
  description = "ARN de la tabla DynamoDB de bloqueo."
}

variable "arn_clave_estado" {
  type        = string
  description = "ARN de la clave KMS que cifra el estado."
}

variable "arn_politica_apply" {
  type        = string
  description = "Política administrada del rol de apply. Terraform crea roles IAM, así que necesita permisos amplios: el límite real es la condición de la rama."
  default     = "arn:aws:iam::aws:policy/AdministratorAccess"
}

variable "etiquetas_comunes" {
  type        = map(string)
  description = "Etiquetas obligatorias del proyecto (Project, Env, Owner)."
  default     = {}
}
