mock_provider "aws" {}

variables {
  correos_alerta = ["equipo@example.com"]
}

run "presupuestos_con_alertas_50_75_90_y_pronostico" {
  command = plan

  assert {
    condition     = aws_budgets_budget.mensual.limit_amount == "35" && aws_budgets_budget.creditos.limit_amount == "200"
    error_message = "Los límites por defecto son USD 35 al mes y USD 200 de créditos."
  }

  assert {
    condition = alltrue([
      for n in [50, 75, 90] :
      length([for x in aws_budgets_budget.mensual.notification : x if x.threshold == n && x.notification_type == "ACTUAL"]) == 1
    ])
    error_message = "El presupuesto mensual debe avisar al 50, 75 y 90 % del gasto real."
  }

  assert {
    condition     = length([for x in aws_budgets_budget.creditos.notification : x if x.notification_type == "FORECASTED"]) == 1
    error_message = "El presupuesto de créditos debe avisar si el pronóstico supera el 100 %."
  }

  assert {
    condition     = aws_budgets_budget.mensual.cost_types[0].include_credit == false
    error_message = "El presupuesto debe medir uso bruto, sin descontar créditos."
  }
}

run "rechaza_lista_de_correos_vacia" {
  command = plan

  variables {
    correos_alerta = []
  }

  expect_failures = [var.correos_alerta]
}

run "crea_su_monitor_de_anomalias_si_la_cuenta_no_tiene_uno" {
  command = plan

  assert {
    condition     = length(aws_ce_anomaly_monitor.servicios) == 1
    error_message = "Sin un monitor existente, el módulo crea el suyo."
  }
}

run "reutiliza_el_monitor_existente_y_no_crea_otro" {
  command = plan

  variables {
    arn_monitor_anomalias_existente = "arn:aws:ce::123456789012:anomalymonitor/11111111-2222-3333-4444-555555555555"
  }

  assert {
    condition     = length(aws_ce_anomaly_monitor.servicios) == 0
    error_message = "Con un monitor existente no se crea otro: AWS solo admite uno de ese tipo por cuenta."
  }

  assert {
    condition     = toset(aws_ce_anomaly_subscription.diaria.monitor_arn_list) == toset(["arn:aws:ce::123456789012:anomalymonitor/11111111-2222-3333-4444-555555555555"])
    error_message = "La suscripción debe apuntar al monitor existente."
  }
}

run "rechaza_un_arn_de_monitor_mal_formado" {
  command = plan

  variables {
    arn_monitor_anomalias_existente = "no-es-un-arn"
  }

  expect_failures = [var.arn_monitor_anomalias_existente]
}
