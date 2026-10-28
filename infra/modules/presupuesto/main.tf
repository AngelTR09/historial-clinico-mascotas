# AWS Budgets al 50, 75 y 90 % desde el primer día (documentación del proyecto §11). Es el primer
# recurso del proyecto: se aplica antes que cualquier otro.
#
# `include_credit = false` hace que el presupuesto mida el uso bruto: mientras los
# créditos cubren la factura, el costo neto es 0 y las alertas nunca saltarían.

locals {
  umbrales = [50, 75, 90]
}

resource "aws_budgets_budget" "mensual" {
  name         = "${var.nombre_proyecto}-mensual"
  budget_type  = "COST"
  limit_amount = tostring(var.limite_mensual_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_types {
    include_credit = false
    include_refund = false
  }

  dynamic "notification" {
    for_each = local.umbrales

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = var.correos_alerta
    }
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.correos_alerta
  }

  tags = var.etiquetas_comunes
}

resource "aws_budgets_budget" "creditos" {
  name         = "${var.nombre_proyecto}-creditos-totales"
  budget_type  = "COST"
  limit_amount = tostring(var.limite_creditos_usd)
  limit_unit   = "USD"
  time_unit    = "ANNUALLY"

  cost_types {
    include_credit = false
    include_refund = false
  }

  dynamic "notification" {
    for_each = local.umbrales

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = var.correos_alerta
    }
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.correos_alerta
  }

  tags = var.etiquetas_comunes
}

# AWS crea por su cuenta un monitor de servicios por defecto y cada cuenta admite uno solo de ese tipo
# (CreateAnomalyMonitor responde "Limit exceeded"). Si la cuenta ya lo tiene, se pasa su ARN en
# arn_monitor_anomalias_existente y aquí no se crea otro.
resource "aws_ce_anomaly_monitor" "servicios" {
  count = var.arn_monitor_anomalias_existente == "" ? 1 : 0

  name              = "${var.nombre_proyecto}-servicios"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"

  tags = var.etiquetas_comunes
}

locals {
  arn_monitor_anomalias = var.arn_monitor_anomalias_existente != "" ? var.arn_monitor_anomalias_existente : one(aws_ce_anomaly_monitor.servicios[*].arn)
}

resource "aws_ce_anomaly_subscription" "diaria" {
  name             = "${var.nombre_proyecto}-anomalias"
  frequency        = "DAILY"
  monitor_arn_list = [local.arn_monitor_anomalias]

  dynamic "subscriber" {
    for_each = toset(var.correos_alerta)

    content {
      type    = "EMAIL"
      address = subscriber.value
    }
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      match_options = ["GREATER_THAN_OR_EQUAL"]
      values        = [tostring(var.umbral_anomalia_usd)]
    }
  }

  tags = var.etiquetas_comunes
}
