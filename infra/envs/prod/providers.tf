provider "aws" {
  region              = var.region
  allowed_account_ids = length(var.ids_cuentas_permitidas) == 0 ? null : var.ids_cuentas_permitidas

  default_tags {
    tags = {
      Project = "hcm"
      Env     = "prod"
      Owner   = var.owner
    }
  }
}
