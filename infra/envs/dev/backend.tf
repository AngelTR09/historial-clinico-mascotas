# Backend parcial: el bucket y la tabla salen de envs/bootstrap y se pasan al iniciar:
#   terraform init -backend-config=backend.hcl
terraform {
  backend "s3" {}
}
