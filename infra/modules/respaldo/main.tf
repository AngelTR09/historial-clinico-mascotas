# AWS Backup (RNF 09 y 12): respaldo completo diario en la madrugada de Lima y respaldo
# continuo con recuperación a un punto en el tiempo, para que la pérdida máxima sea de
# 5 minutos y la restauración quepa en 30. El tiempo real de restauración se mide en la
# demostración (paso 13 del guion del PMV).

resource "aws_backup_vault" "principal" {
  force_destroy = var.forzar_borrado
  name          = "${var.nombre_proyecto}-boveda"
  kms_key_arn   = var.arn_clave_datos

  tags = var.etiquetas_comunes
}

resource "aws_backup_plan" "principal" {
  name = "${var.nombre_proyecto}-respaldos"

  rule {
    rule_name         = "completo-diario"
    target_vault_name = aws_backup_vault.principal.name
    schedule          = "cron(0 6 * * ? *)"

    lifecycle {
      delete_after = var.dias_retencion
    }
  }

  rule {
    rule_name                = "continuo-pitr"
    target_vault_name        = aws_backup_vault.principal.name
    enable_continuous_backup = true

    lifecycle {
      delete_after = var.dias_retencion
    }
  }

  tags = var.etiquetas_comunes
}

resource "aws_iam_role" "respaldo" {
  name = "${var.nombre_proyecto}-aws-backup"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "backup.amazonaws.com" }
    }]
  })

  tags = var.etiquetas_comunes
}

resource "aws_iam_role_policy_attachment" "respaldo" {
  role       = aws_iam_role.respaldo.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "restauracion" {
  role       = aws_iam_role.respaldo.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

resource "aws_backup_selection" "principal" {
  name         = "${var.nombre_proyecto}-recursos"
  plan_id      = aws_backup_plan.principal.id
  iam_role_arn = aws_iam_role.respaldo.arn
  resources    = var.arns_recursos
}
