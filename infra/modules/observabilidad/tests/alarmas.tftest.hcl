mock_provider "aws" {}

variables {
  arn_tema_alertas         = "arn:aws:sns:us-east-1:123456789012:hcm-alertas"
  sufijo_arn_alb           = "app/hcm-alb/abc123"
  sufijo_arn_grupo_destino = "targetgroup/hcm-api/def456"
  identificador_rds        = "hcm-postgres"
  nombres_colas            = { ocr = "hcm-ocr", recordatorios = "hcm-recordatorios" }
  nombres_colas_fallidos   = { ocr = "hcm-ocr-dlq", recordatorios = "hcm-recordatorios-dlq" }
}

run "umbrales_del_proyecto" {
  command = plan

  assert {
    condition     = aws_cloudwatch_metric_alarm.errores_5xx.threshold == 1 && aws_cloudwatch_metric_alarm.latencia_p95.threshold == 2
    error_message = "Alertar con más de 1 % de errores y p95 mayor a 2 s."
  }

  assert {
    condition     = alltrue([for a in aws_cloudwatch_metric_alarm.cola_saturada : a.threshold == 5000])
    error_message = "Alertar cuando una cola supera 5 000 mensajes."
  }

  assert {
    condition     = alltrue([for a in aws_cloudwatch_metric_alarm.mensaje_en_dlq : a.threshold == 0])
    error_message = "Un solo mensaje en una DLQ debe alertar (RNF 18)."
  }

  assert {
    condition     = alltrue([for a in aws_cloudwatch_metric_alarm.cola_saturada : contains(a.alarm_actions, var.arn_tema_alertas)])
    error_message = "Toda alarma debe avisar al tema de alertas."
  }
}
