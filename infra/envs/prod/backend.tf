# Backend parcial: el bucket y la clave KMS salen de envs/bootstrap y se pasan al iniciar:
#   terraform init -backend-config=backend.hcl
terraform {
  backend "s3" {}
}
