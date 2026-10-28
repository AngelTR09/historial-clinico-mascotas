mock_provider "aws" {}

variables {
  id_vpc                = "vpc-123"
  ids_subredes_publicas = ["subnet-aaa", "subnet-bbb"]
  id_sg_alb             = "sg-alb"
  id_sg_api             = "sg-api"
  arn_clave_datos       = "arn:aws:kms:us-east-1:123456789012:key/11111111-2222-3333-4444-555555555555"
  arn_bucket_evidencias = "arn:aws:s3:::hcm-evidencias-123456789012"
  arns_tablas_dynamodb  = ["arn:aws:dynamodb:us-east-1:123456789012:table/hcm-public-profile"]
  arns_colas            = ["arn:aws:sqs:us-east-1:123456789012:hcm-ocr"]
  arns_secretos         = ["arn:aws:secretsmanager:us-east-1:123456789012:secret:hcm/doc-hmac-pepper-abc123"]
}

run "api_con_rollback_autoescalado_y_tareas_minimas" {
  command = plan

  assert {
    condition     = aws_ecs_service.api.deployment_circuit_breaker[0].enable && aws_ecs_service.api.deployment_circuit_breaker[0].rollback
    error_message = "Una versión rota debe revertirse sola."
  }

  assert {
    condition     = aws_appautoscaling_target.api.min_capacity == 1 && aws_appautoscaling_target.api.max_capacity == 4
    error_message = "Por defecto 1 a 4 tareas."
  }

  assert {
    condition     = aws_appautoscaling_policy.cpu.target_tracking_scaling_policy_configuration[0].scale_out_cooldown == 60
    error_message = "El escalado hacia afuera debe reaccionar en menos de 90 s (SLO de escalado)."
  }

  assert {
    condition     = aws_ecr_repository.api.image_tag_mutability == "IMMUTABLE" && aws_ecr_repository.api.image_scanning_configuration[0].scan_on_push
    error_message = "Las imágenes son inmutables y se escanean al subirlas."
  }
}

run "dos_tareas_para_rnf_08_y_11" {
  command = plan

  variables {
    tareas_minimas = 2
  }

  assert {
    condition     = aws_appautoscaling_target.api.min_capacity == 2
    error_message = "Con tareas_minimas = 2 hay una tarea por zona."
  }
}

run "rechaza_cero_tareas" {
  command = plan

  variables {
    tareas_minimas = 0
  }

  expect_failures = [var.tareas_minimas]
}

run "no_fuerza_el_borrado_por_defecto" {
  command = plan

  assert {
    condition     = aws_ecr_repository.api.force_delete == false
    error_message = "Por defecto el destroy no debe borrar con contenido: solo dev lo activa."
  }
}

run "dev_puede_forzar_el_borrado" {
  command = plan

  variables {
    forzar_borrado = true
  }

  assert {
    condition     = aws_ecr_repository.api.force_delete == true
    error_message = "Con forzar_borrado el destroy debe poder borrar con contenido (dev)."
  }
}
