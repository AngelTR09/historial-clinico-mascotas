# Se aplica UNA vez, con estado local, antes que cualquier otro entorno. Después de
# aplicarlo se copia terraform.tfstate al bucket que él mismo crea (terraform init
# -migrate-state) y dev y prod pasan a usar ese bucket como backend.
# Ver AWS-hcm/README.md para el procedimiento completo.

provider "aws" {
  region = var.region

  default_tags {
    tags = local.etiquetas
  }
}

locals {
  etiquetas = {
    Project = "hcm"
    Env     = "bootstrap"
    Owner   = var.owner
  }
}

module "estado" {
  source = "../../modules/bootstrap"

  nombre_proyecto   = var.nombre_proyecto
  etiquetas_comunes = local.etiquetas
}

module "presupuesto" {
  source = "../../modules/presupuesto"

  nombre_proyecto                 = var.nombre_proyecto
  correos_alerta                  = var.correos_alerta
  arn_monitor_anomalias_existente = var.arn_monitor_anomalias_existente
  etiquetas_comunes               = local.etiquetas
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  nombre_proyecto      = var.nombre_proyecto
  repositorio_github   = var.repositorio_github
  crear_proveedor_oidc = var.crear_proveedor_oidc
  arn_bucket_estado    = module.estado.arn_bucket_estado
  arn_tabla_bloqueo    = module.estado.arn_tabla_bloqueo
  arn_clave_estado     = module.estado.arn_clave_estado
  etiquetas_comunes    = local.etiquetas
}
