provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project = "hcm"
      Env     = "dev"
      Owner   = var.owner
    }
  }
}
