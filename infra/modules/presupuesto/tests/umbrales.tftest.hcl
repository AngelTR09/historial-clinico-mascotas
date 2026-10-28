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
