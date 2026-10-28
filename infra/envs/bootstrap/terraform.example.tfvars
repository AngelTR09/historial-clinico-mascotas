# Copiar a terraform.tfvars (ignorado por git) y completar.
owner          = "angel"
correos_alerta = ["tu-correo@example.com"]

# Si AWS responde "Limit exceeded on dimensional spend monitor creation", la cuenta ya tiene el monitor
# de anomalías por defecto: copia su ARN (aws ce get-anomaly-monitors) y descomenta.
# arn_monitor_anomalias_existente = "arn:aws:ce::<cuenta>:anomalymonitor/<id>"

# Recomendado: Terraform se niega a operar si las credenciales son de otra cuenta.
# ids_cuentas_permitidas = ["<id-de-cuenta>"]

# true si la cuenta ya tiene el proveedor OIDC de GitHub (solo admite uno).
# crear_proveedor_oidc = false
