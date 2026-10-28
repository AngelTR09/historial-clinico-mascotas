mock_provider "aws" {
  mock_resource "aws_sns_topic" {
    defaults = { arn = "arn:aws:sns:us-east-1:123456789012:tema" }
  }

  mock_resource "aws_sqs_queue" {
    defaults = { arn = "arn:aws:sqs:us-east-1:123456789012:cola" }
  }
}

variables {
  arn_clave_datos = "arn:aws:kms:us-east-1:123456789012:key/11111111-2222-3333-4444-555555555555"
  correos_alerta  = ["equipo@example.com"]
}

run "cada_cola_tiene_dlq_y_tres_intentos" {
  # apply con proveedor simulado: el ARN de la DLQ queda conocido y se puede leer el redrive_policy.
  command = apply

  assert {
    condition     = length(aws_sqs_queue.cola) == 3 && length(aws_sqs_queue.fallidos) == 3
    error_message = "Cada una de las tres colas debe tener su DLQ."
  }

  assert {
    condition     = strcontains(aws_sqs_queue.cola["recordatorios"].redrive_policy, "\"maxReceiveCount\":3")
    error_message = "Los recordatorios deben reintentarse 3 veces antes de ir a la DLQ (RNF 18)."
  }

  assert {
    condition     = aws_sqs_queue.cola["normalizacion"].sqs_managed_sse_enabled && aws_sns_topic.alertas.kms_master_key_id == var.arn_clave_datos
    error_message = "Colas y temas deben ir cifrados."
  }
}

run "ses_verifica_el_remitente_y_los_destinatarios_de_prueba_sin_duplicar" {
  command = apply

  variables {
    correo_remitente   = "no-responder@hcm.example"
    correos_ses_prueba = ["dueno@example.com", "no-responder@hcm.example"]
  }

  assert {
    condition     = length(aws_sesv2_email_identity.correo) == 2
    error_message = "Remitente y destinatario de prueba, cada uno una sola vez."
  }

  assert {
    condition     = length(output.arns_identidades_ses) == 2
    error_message = "Los ARN de las identidades se exponen para los permisos de la API y del notificador."
  }
}

run "sin_correos_no_se_crea_ninguna_identidad" {
  command = apply

  assert {
    condition     = length(aws_sesv2_email_identity.correo) == 0
    error_message = "Sin remitente ni destinatarios no hay identidades que verificar."
  }
}
