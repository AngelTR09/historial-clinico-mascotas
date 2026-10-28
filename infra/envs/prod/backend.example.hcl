# Copiar a backend.hcl (ignorado por git) con los outputs de envs/bootstrap.
# El bucket de estado está en la misma región que el resto del laboratorio (us-east-2).
bucket     = "hcm-tfstate-<id-de-cuenta>-us-east-2"
key        = "lab09/prod/terraform.tfstate"
region     = "us-east-2"
encrypt    = true
kms_key_id = "<arn_clave_estado de envs/bootstrap>"

# Bloqueo del estado con un archivo <clave>.tflock en el propio bucket (sin tabla DynamoDB, que está deprecada).
use_lockfile = true

# Evita aplicar contra una cuenta equivocada.
allowed_account_ids = ["<id-de-cuenta>"]
