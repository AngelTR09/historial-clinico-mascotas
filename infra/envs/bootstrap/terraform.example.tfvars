# Copiar a terraform.tfvars (ignorado por git) y completar.
owner          = "angel"
correos_alerta = ["tu-correo@example.com"]

# Si AWS responde "Limit exceeded on dimensional spend monitor creation", la cuenta ya tiene el monitor
# de anomalías por defecto: copia su ARN (aws ce get-anomaly-monitors) y descomenta.
# arn_monitor_anomalias_existente = "arn:aws:ce::<cuenta>:anomalymonitor/<id>"

# Prefijo del estado del entorno dev (la clave es <prefijo>/terraform.tfstate). El rol de despliegue solo toca este prefijo.
# prefijo_estado = "lab09/dev"

# Recomendado: Terraform se niega a operar si las credenciales son de otra cuenta.
# ids_cuentas_permitidas = ["<id-de-cuenta>"]

# Si GitHub emite el sub con identificador inmutable (el job plan falla con "Not authorized to perform
# sts:AssumeRoleWithWebIdentity"), poner el prefijo exacto del repositorio:
#   gh api repos/<dueño>/<repo>/actions/oidc/customization/sub --jq .sub_claim_prefix
# prefijo_sub_github = "repo:<dueño>@<id>/<repo>@<id>"

# true si la cuenta ya tiene el proveedor OIDC de GitHub (solo admite uno).
# crear_proveedor_oidc = false
