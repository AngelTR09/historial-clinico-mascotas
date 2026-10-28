# Workers asíncronos (documentación del proyecto §5): cuatro Lambdas Node 20.
#   proyector     SQS proyeccion     Postgres -> DynamoDB (ficha pública); también recarga las existentes
#   normalizador  SQS normalizacion  texto libre de vacunas -> catálogo canónico; pide reproyectar la ficha
#   recordatorios EventBridge diario busca vencimientos y los ENCOLA
#   notificador   SQS recordatorios  envía el correo por SES; si falla 3 veces va a la DLQ
# Separar "encolar" de "notificar" es lo que garantiza que ningún recordatorio se pierda
# cuando el correo falla (RNF 15 y 18). El OCR y la carga masiva de albergue quedan fuera del PMV.

locals {
  funciones = {
    proyector = {
      cola    = "proyeccion"
      en_vpc  = true
      timeout = 60
      memoria = 256
      extra = [
        { Effect = "Allow", Action = ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"], Resource = var.arn_tabla_perfil_publico },
        { Effect = "Allow", Action = "secretsmanager:GetSecretValue", Resource = var.arn_secreto_bd },
        # Para la recarga manual de la proyección (`{"accion":"reconstruir-todo"}`): reencola cada mascota.
        { Effect = "Allow", Action = "sqs:SendMessage", Resource = var.arns_colas["proyeccion"] },
      ]
      entorno = { TABLA_PERFIL_PUBLICO = var.nombre_tabla_perfil_publico, URL_COLA_PROYECCION = var.urls_colas["proyeccion"] }
    }
    normalizador = {
      cola    = "normalizacion"
      en_vpc  = true
      timeout = 60
      memoria = 256
      extra = [
        { Effect = "Allow", Action = "secretsmanager:GetSecretValue", Resource = var.arn_secreto_bd },
        { Effect = "Allow", Action = "sqs:SendMessage", Resource = var.arns_colas["proyeccion"] },
      ]
      entorno = { URL_COLA_PROYECCION = var.urls_colas["proyeccion"] }
    }
    recordatorios = {
      cola    = null
      en_vpc  = true
      timeout = 120
      memoria = 256
      extra = [
        { Effect = "Allow", Action = "secretsmanager:GetSecretValue", Resource = var.arn_secreto_bd },
        { Effect = "Allow", Action = "sqs:SendMessage", Resource = var.arns_colas["recordatorios"] },
      ]
      entorno = { URL_COLA_RECORDATORIOS = var.urls_colas["recordatorios"] }
    }
    notificador = {
      cola    = "recordatorios"
      en_vpc  = false
      timeout = 30
      memoria = 128
      extra   = [{ Effect = "Allow", Action = "ses:SendEmail", Resource = var.arns_identidades_ses }]
      entorno = { CORREO_REMITENTE = var.correo_remitente }
    }
  }

  consumen_cola = { for k, f in local.funciones : k => f if f.cola != null }
  en_vpc        = { for k, f in local.funciones : k => f if f.en_vpc }
}

# Errores de invocaciones asíncronas (p. ej. el barrido diario) quedan guardados aquí.
resource "aws_sqs_queue" "fallidos_lambda" {
  name                      = "${var.nombre_proyecto}-lambda-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true

  tags = var.etiquetas_comunes
}

resource "aws_cloudwatch_log_group" "funcion" {
  for_each = local.funciones

  name              = "/aws/lambda/${var.nombre_proyecto}-${replace(each.key, "_", "-")}"
  retention_in_days = var.dias_logs
  kms_key_id        = var.arn_clave_datos

  tags = var.etiquetas_comunes
}

resource "aws_iam_role" "funcion" {
  for_each = local.funciones

  name = "${var.nombre_proyecto}-${replace(each.key, "_", "-")}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = var.etiquetas_comunes
}

resource "aws_iam_role_policy_attachment" "basica" {
  for_each = local.funciones

  role       = aws_iam_role.funcion[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "vpc" {
  for_each = local.en_vpc

  role       = aws_iam_role.funcion[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "funcion" {
  for_each = local.funciones

  name = "permisos-minimos"
  role = aws_iam_role.funcion[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        { Effect = "Allow", Action = "sqs:SendMessage", Resource = aws_sqs_queue.fallidos_lambda.arn },
        { Effect = "Allow", Action = ["kms:Decrypt", "kms:GenerateDataKey"], Resource = var.arn_clave_datos },
      ],
      each.value.cola == null ? [] : [{
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = var.arns_colas[each.value.cola]
      }],
      each.value.extra,
    )
  })
}

# aws-lambda-enable-tracing: Sin X-Ray: diferido, ningún RNF del PDF lo exige (documentación del proyecto §18).
#tfsec:ignore:aws-lambda-enable-tracing
resource "aws_lambda_function" "funcion" {
  #checkov:skip=CKV_AWS_50:Sin X-Ray: diferido, ningun RNF lo exige
  #checkov:skip=CKV_AWS_115:Sin concurrencia reservada: una cuenta nueva solo tiene 10 de concurrencia y reservar impide crear la funcion; el limite real es maximum_concurrency de la fuente SQS (protege a RDS)
  #checkov:skip=CKV_AWS_117:El notificador solo habla con SES y SQS: meterlo en la VPC exigiria endpoints de interfaz mas
  #checkov:skip=CKV_AWS_272:Sin firma de codigo: el paquete lo construye y sube el pipeline de GitHub Actions
  for_each = local.funciones

  function_name = "${var.nombre_proyecto}-${replace(each.key, "_", "-")}"
  role          = aws_iam_role.funcion[each.key].arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  architectures = ["x86_64"]
  filename      = "${var.directorio_paquetes}/${each.key}.zip"
  timeout       = each.value.timeout
  memory_size   = each.value.memoria
  kms_key_arn   = var.arn_clave_datos

  environment {
    variables = merge(var.variables_entorno, each.value.entorno, each.value.en_vpc ? {
      DB_HOST        = var.direccion_rds
      ARN_SECRETO_BD = var.arn_secreto_bd
    } : {})
  }

  dynamic "vpc_config" {
    for_each = each.value.en_vpc ? [1] : []

    content {
      subnet_ids         = var.ids_subredes_privadas
      security_group_ids = [var.id_sg_funciones]
    }
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.fallidos_lambda.arn
  }

  depends_on = [
    aws_cloudwatch_log_group.funcion,
    aws_iam_role_policy_attachment.basica,
    aws_iam_role_policy_attachment.vpc,
    aws_iam_role_policy.funcion,
  ]

  # El zip solo se necesita para crear la función; después el código lo actualiza el
  # pipeline (deploy-workers.yml) y Terraform no debe revertirlo.
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  tags = var.etiquetas_comunes
}

# maximum_concurrency acota cuántas invocaciones paralelas abre cada cola: protege a RDS
# cuando llega una carga masiva o el barrido de recordatorios.
resource "aws_lambda_event_source_mapping" "cola" {
  for_each = local.consumen_cola

  function_name                      = aws_lambda_function.funcion[each.key].arn
  event_source_arn                   = var.arns_colas[each.value.cola]
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
  function_response_types            = ["ReportBatchItemFailures"]

  scaling_config {
    maximum_concurrency = 5
  }
}

resource "aws_cloudwatch_event_rule" "barrido_diario" {
  name                = "${var.nombre_proyecto}-barrido-recordatorios"
  description         = "Dispara el barrido diario de vencimientos de vacunas"
  schedule_expression = var.cron_recordatorios

  tags = var.etiquetas_comunes
}

resource "aws_cloudwatch_event_target" "barrido_diario" {
  rule = aws_cloudwatch_event_rule.barrido_diario.name
  arn  = aws_lambda_function.funcion["recordatorios"].arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "PermitirEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.funcion["recordatorios"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.barrido_diario.arn
}
