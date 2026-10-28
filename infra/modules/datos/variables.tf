variable "nombre_proyecto" {
  type        = string
  description = "Prefijo de los recursos de datos."
  default     = "hcm"
}

variable "etiquetas_comunes" {
  type        = map(string)
  description = "Etiquetas obligatorias del proyecto (Project, Env, Owner)."
  default     = {}
}

variable "arn_clave_datos" {
  type        = string
  description = "ARN de la clave KMS que cifra RDS, DynamoDB y S3."
}

variable "ids_subredes_privadas" {
  type        = list(string)
  description = "Subredes privadas para RDS (una por zona)."
}

variable "id_sg_db" {
  type        = string
  description = "Grupo de seguridad de RDS."
}

variable "clase_instancia" {
  type        = string
  description = "Clase de la instancia RDS."
  default     = "db.t4g.micro"
}

variable "multi_az" {
  type        = bool
  description = "Réplica standby en otra zona. Se enciende solo en exposición y pruebas (RNF 05, 11): duplica el costo de la base."
  default     = false
}

variable "proteccion_contra_borrado" {
  type        = bool
  description = "deletion_protection de RDS. Siempre true en prod; false solo en dev para poder hacer destroy."
  default     = true
}

variable "omitir_snapshot_final" {
  type        = bool
  description = "Omitir el snapshot final al destruir. Siempre false en prod."
  default     = false
}

variable "dias_retencion_respaldos" {
  type        = number
  description = "Días de respaldo automático de RDS (habilita la recuperación a un punto en el tiempo)."
  default     = 7
}

variable "forzar_borrado" {
  type        = bool
  description = "Permite que terraform destroy borre el bucket de evidencias (con sus versiones) aunque tenga contenido. Solo true en dev (sin él el destroy falla); en prod siempre false y una política OPA lo impide."
  default     = false
}
