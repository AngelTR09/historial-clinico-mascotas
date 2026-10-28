# Una sola clave KMS de datos (RDS, DynamoDB, S3 de evidencias, secretos, logs, SNS) para
# no pagar una clave por servicio, más los contenedores de los secretos de la API. Los
# VALORES de los secretos no están en Terraform: se cargan a mano una vez, para que nunca
# queden en el estado (documentación del proyecto §9: ningún secreto en el repositorio).

data "aws_caller_identity" "actual" {}
data "aws_region" "actual" {}

locals {
  cuenta = data.aws_caller_identity.actual.account_id

  secretos = {
    "doc-encryption-key" = "Clave AES-256 que cifra documento y teléfono en columna (DOC_ENCRYPTION_KEY)"
    "doc-hmac-pepper"    = "Pepper del HMAC-SHA256 que indexa el documento (DOC_HMAC_PEPPER)"
    "firma-acceso-vet"   = "Clave que firma el acceso temporal de 4 h del veterinario (RN 10)"
  }
}

resource "aws_kms_key" "datos" {
  description             = "Cifrado de datos de ${var.nombre_proyecto}: RDS, DynamoDB, S3, secretos, logs y SNS"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "HabilitarIAMDeLaCuenta"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${local.cuenta}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "PermitirCloudWatchLogs"
        Effect    = "Allow"
        Principal = { Service = "logs.${data.aws_region.actual.name}.amazonaws.com" }
        Action    = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
        Resource  = "*"
        Condition = { ArnLike = { "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${data.aws_region.actual.name}:${local.cuenta}:*" } }
      },
      # Las alarmas de CloudWatch no pueden publicar en un tema SNS cifrado con la clave
      # administrada por AWS: hace falta una clave propia con este permiso.
      {
        Sid       = "PermitirAlarmasYSNS"
        Effect    = "Allow"
        Principal = { Service = ["cloudwatch.amazonaws.com", "sns.amazonaws.com"] }
        Action    = ["kms:Decrypt", "kms:GenerateDataKey*"]
        Resource  = "*"
        Condition = { StringEquals = { "aws:SourceAccount" = local.cuenta } }
      },
    ]
  })

  tags = var.etiquetas_comunes
}

resource "aws_kms_alias" "datos" {
  name          = "alias/${var.nombre_proyecto}-datos"
  target_key_id = aws_kms_key.datos.key_id
}

resource "aws_secretsmanager_secret" "api" {
  #checkov:skip=CKV2_AWS_57:No se rota automaticamente: rotar DOC_ENCRYPTION_KEY o DOC_HMAC_PEPPER con datos reales rompe el indice HMAC y el descifrado (plan de migracion, fase 2)
  for_each = local.secretos

  name                    = "${var.nombre_proyecto}/${each.key}"
  description             = each.value
  kms_key_id              = aws_kms_key.datos.arn
  recovery_window_in_days = var.dias_recuperacion_secretos

  tags = var.etiquetas_comunes
}

resource "aws_ssm_parameter" "configuracion" {
  #checkov:skip=CKV2_AWS_34:Son banderas de configuracion no secretas (p. ej. OCR_ENABLED); los secretos van en Secrets Manager
  for_each = var.parametros

  name  = "/${var.nombre_proyecto}/${each.key}"
  type  = "String"
  value = each.value

  tags = var.etiquetas_comunes
}
