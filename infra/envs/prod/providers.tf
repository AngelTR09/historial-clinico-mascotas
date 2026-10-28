provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project = "hcm"
      Env     = "prod"
      Owner   = var.owner
    }
  }
}
