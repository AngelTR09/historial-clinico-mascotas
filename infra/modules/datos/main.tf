# Datos del MVP: PostgreSQL 17 (verdad transaccional), DynamoDB (solo la ficha pública,
# ADR 0001) y el bucket de evidencias. La tabla de idempotencia de la arquitectura objetivo
# NO se crea: en el MVP la clave vive en Postgres (UNIQUE en health_events), dentro de la misma
# transacción que la escritura, sin dos almacenes que puedan desincronizarse.

data "aws_caller_identity" "actual" {}

# ---------- RDS PostgreSQL ----------

resource "aws_db_subnet_group" "principal" {
  name       = "${var.nombre_proyecto}-db"
  subnet_ids = var.ids_subredes_privadas

  tags = var.etiquetas_comunes
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${var.nombre_proyecto}-postgres17"
  family = "postgres17"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = var.etiquetas_comunes
}

# aws-rds-enable-performance-insights: Las métricas de CloudWatch alcanzan para los RNF y la clase micro no aprovecha Performance Insights.
# aws-rds-enable-deletion-protection: Se controla con proteccion_contra_borrado: true en prod y false en dev, para poder hacer destroy fuera de las sesiones de laboratorio.
# aws-rds-specify-backup-retention: El plan gratuito de AWS limita los respaldos a 1 día (FreeTierRestrictionError). Solo se usa en dev; una política OPA exige al menos 7 días en prod.
#tfsec:ignore:aws-rds-enable-performance-insights
#tfsec:ignore:aws-rds-specify-backup-retention
resource "aws_db_instance" "principal" {
  #checkov:skip=CKV_AWS_293:deletion_protection lo controla proteccion_contra_borrado: true en prod, false en dev para poder hacer destroy
  #checkov:skip=CKV_AWS_353:Sin Performance Insights: las metricas de CloudWatch alcanzan para los RNF y la clase micro no los aprovecha
  #checkov:skip=CKV_AWS_157:Multi-AZ se controla con la variable multi_az: apagado por defecto por costo, se enciende en exposicion y pruebas
  #checkov:skip=CKV_AWS_118:Sin monitoreo mejorado: las metricas de CloudWatch alcanzan para los RNF; evita rol y costo adicional
  #checkov:skip=CKV2_AWS_30:Sin log de consultas: podria registrar datos personales y el pino de la API ya audita
  identifier     = "${var.nombre_proyecto}-postgres"
  engine         = "postgres"
  engine_version = "17"
  instance_class = var.clase_instancia

  db_name  = "hcm"
  username = "hcm_admin"

  # RDS crea y guarda la contraseña en Secrets Manager: nunca pasa por el estado.
  manage_master_user_password   = true
  master_user_secret_kms_key_id = var.arn_clave_datos

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.arn_clave_datos

  db_subnet_group_name   = aws_db_subnet_group.principal.name
  vpc_security_group_ids = [var.id_sg_db]
  parameter_group_name   = aws_db_parameter_group.postgres.name
  publicly_accessible    = false
  multi_az               = var.multi_az

  iam_database_authentication_enabled = true
  auto_minor_version_upgrade          = true
  copy_tags_to_snapshot               = true
  enabled_cloudwatch_logs_exports     = ["postgresql", "upgrade"]

  # Respaldo completo diario en la madrugada (hora de Lima) + WAL continuo = RPO <= 5 min.
  backup_retention_period = var.dias_retencion_respaldos
  backup_window           = "06:00-07:00"
  maintenance_window      = "sun:08:00-sun:09:00"

  #tfsec:ignore:aws-rds-enable-deletion-protection
  deletion_protection       = var.proteccion_contra_borrado
  skip_final_snapshot       = var.omitir_snapshot_final
  final_snapshot_identifier = var.omitir_snapshot_final ? null : "${var.nombre_proyecto}-postgres-final"

  tags = var.etiquetas_comunes
}

# ---------- DynamoDB ----------

resource "aws_dynamodb_table" "perfil_publico" {
  name         = "${var.nombre_proyecto}-public-profile"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "qr_token"

  attribute {
    name = "qr_token"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.arn_clave_datos
  }

  tags = var.etiquetas_comunes
}

# ---------- S3 de evidencias ----------

# aws-s3-enable-bucket-logging: Sin logs de acceso de S3: la auditoría de expedientes (RN 9) vive en audit_log, no en logs de S3.
#tfsec:ignore:aws-s3-enable-bucket-logging
resource "aws_s3_bucket" "evidencias" {
  force_destroy = var.forzar_borrado
  #checkov:skip=CKV_AWS_18:Sin logs de acceso: la auditoria de expedientes (RN 9) vive en audit_log, no en logs de S3
  #checkov:skip=CKV_AWS_144:Sin replicacion entre regiones: no la exige ningun RNF y duplicaria el costo de las imagenes
  #checkov:skip=CKV2_AWS_62:Sin notificaciones de eventos: el OCR se encola desde la API, no desde S3
  bucket = "${var.nombre_proyecto}-evidencias-${data.aws_caller_identity.actual.account_id}"

  tags = var.etiquetas_comunes
}

resource "aws_s3_bucket_versioning" "evidencias" {
  bucket = aws_s3_bucket.evidencias.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidencias" {
  bucket = aws_s3_bucket.evidencias.id

  rule {
    bucket_key_enabled = true

    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.arn_clave_datos
    }
  }
}

resource "aws_s3_bucket_public_access_block" "evidencias" {
  bucket                  = aws_s3_bucket.evidencias.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Evidencias a Glacier Instant Retrieval a los 90 días (documentación del proyecto §11).
resource "aws_s3_bucket_lifecycle_configuration" "evidencias" {
  bucket = aws_s3_bucket.evidencias.id

  rule {
    id     = "evidencias-a-glacier-ir"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.evidencias]
}

resource "aws_s3_bucket_policy" "evidencias" {
  bucket = aws_s3_bucket.evidencias.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "SoloConTLS"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.evidencias.arn, "${aws_s3_bucket.evidencias.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.evidencias]
}
