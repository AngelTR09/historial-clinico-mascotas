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

variable "prefijo_sub_github" {
  type        = string
  description = "Prefijo del claim sub que GitHub emite para el repositorio. Con identificador inmutable es repo:<dueño>@<id>/<repo>@<id>; se obtiene con: gh api repos/<dueño>/<repo>/actions/oidc/customization/sub --jq .sub_claim_prefix. Vacío: repo:<repositorio_github>."
  default     = ""

  validation {
    condition     = var.prefijo_sub_github == "" || can(regex("^repo:[A-Za-z0-9._-]+(@[0-9]+)?/[A-Za-z0-9._-]+(@[0-9]+)?$", var.prefijo_sub_github))
    error_message = "Debe tener la forma repo:<dueño>@<id>/<repo>@<id> (los @<id> son opcionales), sin comodines."
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

variable "arn_clave_estado" {
  type        = string
  description = "ARN de la clave KMS que cifra el estado."
}

variable "etiquetas_comunes" {
  type        = map(string)
  description = "Etiquetas obligatorias del proyecto (Project, Env, Owner)."
  default     = {}
}

variable "entorno_despliegue" {
  type        = string
  description = "GitHub Environment cuyos jobs pueden asumir el rol de despliegue. Debe tener en GitHub (Settings > Environments) la rama de despliegue como única rama permitida: AWS solo ve el nombre del environment, no la rama."
  default     = "dev"

  validation {
    condition     = can(regex("^[A-Za-z0-9._-]+$", var.entorno_despliegue))
    error_message = "El nombre del environment solo puede llevar letras, números, punto, guion y guion bajo (sin comodines)."
  }
}

variable "nombre_rol_despliegue" {
  type        = string
  description = "Nombre del rol de despliegue (un nombre identificable)."
  default     = "lab09-github-actions-dev"
}

variable "prefijo_estado" {
  type        = string
  description = "Prefijo del estado de Terraform del entorno desplegado (la clave es <prefijo>/terraform.tfstate)."
  default     = "lab09/dev"

  validation {
    condition     = can(regex("^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$", var.prefijo_estado))
    error_message = "El prefijo del estado no puede llevar comodines ni empezar o terminar con barra."
  }
}

variable "region" {
  type        = string
  description = "Región de AWS donde se despliega el laboratorio: la política de despliegue solo permite servicios regionales en ella."
  default     = "us-east-2"
}
