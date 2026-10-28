mock_provider "aws" {
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/respaldo" }
  }
}

variables {
  arn_clave_datos = "arn:aws:kms:us-east-1:123456789012:key/11111111-2222-3333-4444-555555555555"
  arns_recursos   = ["arn:aws:rds:us-east-1:123456789012:db:hcm-postgres"]
}

run "completo_diario_y_continuo" {
  # apply con proveedor simulado: los atributos calculados de las reglas quedan conocidos.
  command = apply

  assert {
    condition     = length([for r in aws_backup_plan.principal.rule : r if r.enable_continuous_backup == true]) == 1 && length(aws_backup_plan.principal.rule) == 2
    error_message = "Debe haber un respaldo completo diario y uno continuo (RNF 09)."
  }

  assert {
    condition     = length([for r in aws_backup_plan.principal.rule : r if r.schedule == "cron(0 6 * * ? *)"]) == 1
    error_message = "El respaldo completo corre a las 06:00 UTC (01:00 en Lima, la madrugada)."
  }
}

run "rechaza_retencion_mayor_a_35_dias" {
  command = plan

  variables {
    dias_retencion = 60
  }

  expect_failures = [var.dias_retencion]
}
