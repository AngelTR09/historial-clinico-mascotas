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

run "no_fuerza_el_borrado_por_defecto" {
  command = plan

  assert {
    condition     = aws_backup_vault.principal.force_destroy == false
    error_message = "Por defecto el destroy no debe borrar con contenido: solo dev lo activa."
  }
}

run "dev_puede_forzar_el_borrado" {
  command = plan

  variables {
    forzar_borrado = true
  }

  assert {
    condition     = aws_backup_vault.principal.force_destroy == true
    error_message = "Con forzar_borrado el destroy debe poder borrar con contenido (dev)."
  }
}

run "las_reglas_declaran_los_valores_vacios_que_aws_devuelve" {
  command = apply

  assert {
    condition     = alltrue([for r in aws_backup_plan.principal.rule : length(r.recovery_point_tags) == 0 && r.lifecycle[0].cold_storage_after == 0])
    error_message = "Sin declarar recovery_point_tags y cold_storage_after, cada plan veria las reglas como distintas."
  }

  assert {
    condition     = length([for r in aws_backup_plan.principal.rule : r if r.enable_continuous_backup == false]) == 1
    error_message = "El respaldo completo diario declara enable_continuous_backup = false de forma explicita."
  }
}
