# Copiar a backend.hcl (ignorado por git) con los outputs de envs/bootstrap.
bucket         = "hcm-tfstate-<id-de-cuenta>"
key            = "dev/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "hcm-tflock"
encrypt        = true
