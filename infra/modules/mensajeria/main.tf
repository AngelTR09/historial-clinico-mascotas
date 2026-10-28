# Colas SQS con su DLQ y los temas SNS. El PDF exige que un recordatorio no se pierda
# aunque el servicio de notificaciones falle (RNF 15 y 18): el mensaje reintenta
# `maximo_recepciones` veces y luego queda guardado en la DLQ.
#
# El PMV solo necesita tres colas. Las de OCR y carga masiva de albergue quedan para el
# segundo incremento (AWS-hcm/PMV): para habilitarlas basta agregarlas a este conjunto.

locals {
  colas = toset(["normalizacion", "proyeccion", "recordatorios"])

  # Con la cuenta de SES en sandbox, el remitente y cada destinatario deben estar verificados.
  identidades_ses = toset(compact(concat([var.correo_remitente], var.correos_ses_prueba)))
}

resource "aws_sqs_queue" "fallidos" {
  for_each = local.colas

  name                      = "${var.nombre_proyecto}-${each.key}-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true

  tags = var.etiquetas_comunes
}

resource "aws_sqs_queue" "cola" {
  for_each = local.colas

  name                       = "${var.nombre_proyecto}-${each.key}"
  visibility_timeout_seconds = var.visibilidad_segundos
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.fallidos[each.key].arn
    maxReceiveCount     = var.maximo_recepciones
  })

  tags = var.etiquetas_comunes
}

resource "aws_sns_topic" "alertas" {
  name              = "${var.nombre_proyecto}-alertas"
  kms_master_key_id = var.arn_clave_datos

  tags = var.etiquetas_comunes
}

resource "aws_sns_topic" "recordatorios" {
  name              = "${var.nombre_proyecto}-recordatorios"
  kms_master_key_id = var.arn_clave_datos

  tags = var.etiquetas_comunes
}

resource "aws_sns_topic_subscription" "alertas_correo" {
  for_each = toset(var.correos_alerta)

  topic_arn = aws_sns_topic.alertas.arn
  protocol  = "email"
  endpoint  = each.value
}

# SES entrega el correo al dueño: el código de 6 dígitos del login y los recordatorios de vacunas
# (RNF 15 y 18). Cada identidad queda "pendiente" hasta que su titular abre el enlace que AWS le envía.
resource "aws_sesv2_email_identity" "correo" {
  for_each = local.identidades_ses

  email_identity = each.value

  tags = var.etiquetas_comunes
}
