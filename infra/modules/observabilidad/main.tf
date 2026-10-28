# Alarmas de CloudWatch que demuestran los RNF y avisan al responsable por SNS:
#   error > 1 %, latencia p95 > 2 s, cola > 5 000, cualquier mensaje en una DLQ,
#   tarea no saludable (falla de una zona) y base de datos con poca capacidad.

locals {
  acciones = [var.arn_tema_alertas]
}

resource "aws_cloudwatch_metric_alarm" "errores_5xx" {
  alarm_name          = "${var.nombre_proyecto}-errores-5xx"
  alarm_description   = "Más de ${var.umbral_error_porcentaje} % de las solicitudes terminan en 5xx"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.umbral_error_porcentaje
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.acciones
  ok_actions          = local.acciones

  metric_query {
    id          = "porcentaje"
    expression  = "100 * errores / solicitudes"
    label       = "Porcentaje de errores 5xx"
    return_data = true
  }

  metric_query {
    id = "errores"

    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      period      = 60
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.sufijo_arn_alb }
    }
  }

  metric_query {
    id = "solicitudes"

    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      period      = 60
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.sufijo_arn_alb }
    }
  }

  tags = var.etiquetas_comunes
}

resource "aws_cloudwatch_metric_alarm" "latencia_p95" {
  alarm_name          = "${var.nombre_proyecto}-latencia-p95"
  alarm_description   = "La latencia p95 supera ${var.umbral_latencia_segundos} s (RNF 07 y 10)"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95"
  period              = 60
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.umbral_latencia_segundos
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = var.sufijo_arn_alb }
  alarm_actions       = local.acciones
  ok_actions          = local.acciones

  tags = var.etiquetas_comunes
}

resource "aws_cloudwatch_metric_alarm" "tarea_no_saludable" {
  alarm_name          = "${var.nombre_proyecto}-tarea-no-saludable"
  alarm_description   = "Hay tareas de la API que no pasan el health check (falla de una zona o versión rota)"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 2
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = var.sufijo_arn_alb, TargetGroup = var.sufijo_arn_grupo_destino }
  alarm_actions       = local.acciones
  ok_actions          = local.acciones

  tags = var.etiquetas_comunes
}

resource "aws_cloudwatch_metric_alarm" "cola_saturada" {
  for_each = var.nombres_colas

  alarm_name          = "${var.nombre_proyecto}-cola-${each.key}-saturada"
  alarm_description   = "La cola ${each.value} supera ${var.umbral_cola} mensajes"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 60
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.umbral_cola
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  dimensions          = { QueueName = each.value }
  alarm_actions       = local.acciones
  ok_actions          = local.acciones

  tags = var.etiquetas_comunes
}

# Un solo mensaje en una DLQ ya es una alerta: significa que algo se reintentó 3 veces y falló
# (RNF 18: nada se pierde, pero alguien debe revisarlo).
resource "aws_cloudwatch_metric_alarm" "mensaje_en_dlq" {
  for_each = var.nombres_colas_fallidos

  alarm_name          = "${var.nombre_proyecto}-dlq-${each.key}"
  alarm_description   = "La DLQ ${each.value} tiene mensajes sin procesar"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 60
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  dimensions          = { QueueName = each.value }
  alarm_actions       = local.acciones
  ok_actions          = local.acciones

  tags = var.etiquetas_comunes
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.nombre_proyecto}-rds-cpu"
  alarm_description   = "La CPU de RDS supera 80 % durante 5 minutos"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 60
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  evaluation_periods  = 5
  treat_missing_data  = "notBreaching"
  dimensions          = { DBInstanceIdentifier = var.identificador_rds }
  alarm_actions       = local.acciones
  ok_actions          = local.acciones

  tags = var.etiquetas_comunes
}

resource "aws_cloudwatch_metric_alarm" "rds_almacenamiento" {
  alarm_name          = "${var.nombre_proyecto}-rds-almacenamiento"
  alarm_description   = "A RDS le quedan menos de 2 GiB libres"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Minimum"
  period              = 300
  comparison_operator = "LessThanThreshold"
  threshold           = 2147483648
  evaluation_periods  = 1
  treat_missing_data  = "notBreaching"
  dimensions          = { DBInstanceIdentifier = var.identificador_rds }
  alarm_actions       = local.acciones
  ok_actions          = local.acciones

  tags = var.etiquetas_comunes
}
