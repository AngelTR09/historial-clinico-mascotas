# Copiar a backend.hcl (ignorado por git) con los outputs de envs/bootstrap.
bucket     = "hcm-tfstate-<id-de-cuenta>"
key        = "dev/terraform.tfstate"
# Región del BUCKET de estado (la del bootstrap), no la de la carga de trabajo.
region     = "us-east-1"
encrypt    = true
kms_key_id = "<arn_clave_estado de envs/bootstrap>"

# Bloqueo del estado. use_lockfile es el recomendado; el bloqueo con DynamoDB está deprecado en Terraform y
# se conserva solo durante la transición (se pueden usar los dos a la vez). Cuando todos los entornos
# usen el archivo de bloqueo se quita dynamodb_table.
use_lockfile   = true
dynamodb_table = "hcm-tflock"

# Evita aplicar contra una cuenta equivocada.
allowed_account_ids = ["<id-de-cuenta>"]
