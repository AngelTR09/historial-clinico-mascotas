# El backend S3 se configura por separado. El bucket y la clave KMS se obtienen
# de envs/bootstrap y se cargan al ejecutar terraform
terraform {
  backend "s3" {}
}
