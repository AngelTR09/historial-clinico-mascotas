# Backend remoto de Terraform: bucket S3 versionado y cifrado, en la región elegida. El bloqueo del
# estado usa el archivo <clave>.tflock del propio bucket (use_lockfile), sin tabla DynamoDB. Se crea UNA
# vez con estado local (envs/bootstrap) y luego dev y prod lo usan como backend. `terraform destroy` fuera de laboratorio NO debe borrarlo:
# cuesta centavos y perder el estado deja huérfana toda la infraestructura.

data "aws_caller_identity" "actual" {}
data "aws_region" "actual" {}

locals {
  # La región va en el nombre: los nombres de bucket son únicos en todo el mundo y el bucket anterior (en otra
  # región) puede existir todavía mientras se migra.
  nombre_bucket = "${var.nombre_proyecto}-tfstate-${data.aws_caller_identity.actual.account_id}-${data.aws_region.actual.name}"
}

resource "aws_kms_key" "estado" {
  description             = "Cifra el estado de Terraform"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "HabilitarIAMDeLaCuenta"
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.actual.account_id}:root" }
      Action    = "kms:*"
      Resource  = "*"
    }]
  })

  tags = var.etiquetas_comunes
}

resource "aws_kms_alias" "estado" {
  name          = "alias/${var.nombre_proyecto}-tfstate"
  target_key_id = aws_kms_key.estado.key_id
}

# aws-s3-enable-bucket-logging: Sin bucket de logs de acceso: costo y mantenimiento sin RNF que lo exija; el bucket es versionado, cifrado y con prevent_destroy.
#tfsec:ignore:aws-s3-enable-bucket-logging
resource "aws_s3_bucket" "estado" {
  #checkov:skip=CKV_AWS_18:Sin bucket de logs de acceso: costo y mantenimiento sin RNF que lo exija; el bucket es versionado, cifrado y con prevent_destroy (CloudTrail queda fuera del PMV)
  #checkov:skip=CKV_AWS_144:Sin replicación entre regiones: el estado se reconstruye con terraform import y el versionado cubre el borrado accidental
  #checkov:skip=CKV2_AWS_62:Sin notificaciones de eventos: ningún consumidor las necesita
  bucket = local.nombre_bucket

  lifecycle {
    prevent_destroy = true
  }

  tags = var.etiquetas_comunes
}

resource "aws_s3_bucket_versioning" "estado" {
  bucket = aws_s3_bucket.estado.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "estado" {
  bucket = aws_s3_bucket.estado.id

  rule {
    bucket_key_enabled = true

    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.estado.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "estado" {
  bucket                  = aws_s3_bucket.estado.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "estado" {
  bucket = aws_s3_bucket.estado.id

  rule {
    id     = "expirar-versiones-antiguas"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.dias_retencion_versiones_antiguas
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.estado]
}

resource "aws_s3_bucket_policy" "estado" {
  bucket = aws_s3_bucket.estado.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "SoloConTLS"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.estado.arn, "${aws_s3_bucket.estado.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.estado]
}
