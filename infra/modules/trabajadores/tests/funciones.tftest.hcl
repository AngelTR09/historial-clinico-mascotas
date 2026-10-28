mock_provider "aws" {
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/rol" }
  }

  mock_resource "aws_sqs_queue" {
    defaults = { arn = "arn:aws:sqs:us-east-1:123456789012:cola" }
  }

  mock_resource "aws_lambda_function" {
    defaults = { arn = "arn:aws:lambda:us-east-1:123456789012:function:f" }
  }

  mock_resource "aws_cloudwatch_event_rule" {
    defaults = { arn = "arn:aws:events:us-east-1:123456789012:rule/r" }
  }
}

variables {
  ids_subredes_privadas       = ["subnet-aaa", "subnet-bbb"]
  id_sg_funciones             = "sg-fun"
  arn_clave_datos             = "arn:aws:kms:us-east-1:123456789012:key/11111111-2222-3333-4444-555555555555"
  arn_tabla_perfil_publico    = "arn:aws:dynamodb:us-east-1:123456789012:table/hcm-public-profile"
  nombre_tabla_perfil_publico = "hcm-public-profile"
  arn_secreto_bd              = "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds-abc123"
  direccion_rds               = "hcm.abc.us-east-1.rds.amazonaws.com"
  arns_identidades_ses        = ["arn:aws:ses:us-east-1:123456789012:identity/no-responder@hcm.example"]
  correo_remitente            = "no-responder@hcm.example"
  arns_colas = {
    proyeccion    = "arn:aws:sqs:us-east-1:123456789012:hcm-proyeccion"
    normalizacion = "arn:aws:sqs:us-east-1:123456789012:hcm-normalizacion"
    recordatorios = "arn:aws:sqs:us-east-1:123456789012:hcm-recordatorios"
  }
  urls_colas = {
    proyeccion    = "https://sqs.us-east-1.amazonaws.com/123456789012/hcm-proyeccion"
    normalizacion = "https://sqs.us-east-1.amazonaws.com/123456789012/hcm-normalizacion"
    recordatorios = "https://sqs.us-east-1.amazonaws.com/123456789012/hcm-recordatorios"
  }
}

run "cuatro_funciones_con_concurrencia_acotada_y_barrido_diario" {
  command = plan

  assert {
    condition     = length(aws_lambda_function.funcion) == 4
    error_message = "Deben existir proyector, normalizador, recordatorios y notificador."
  }

  assert {
    condition     = alltrue([for k, m in aws_lambda_event_source_mapping.cola : m.scaling_config[0].maximum_concurrency <= 5])
    error_message = "Cada cola acota su concurrencia para proteger a RDS."
  }

  assert {
    condition     = length(aws_lambda_event_source_mapping.cola) == 3 && aws_cloudwatch_event_rule.barrido_diario.schedule_expression == "cron(0 13 * * ? *)"
    error_message = "Tres funciones consumen colas y los recordatorios salen del barrido diario de las 08:00 de Lima."
  }

  assert {
    condition     = aws_lambda_function.funcion["notificador"].runtime == "nodejs20.x" && length(aws_lambda_function.funcion["notificador"].vpc_config) == 0
    error_message = "Node 20 y el notificador fuera de la VPC (solo habla con SES y SQS)."
  }
}

run "el_notificador_envia_por_ses_y_el_normalizador_puede_pedir_la_proyeccion" {
  # apply con proveedor simulado: el JSON de la política y el entorno se conocen solo tras aplicar.
  command = apply

  assert {
    condition     = aws_lambda_function.funcion["notificador"].environment[0].variables["CORREO_REMITENTE"] == "no-responder@hcm.example"
    error_message = "El notificador necesita el remitente verificado en SES."
  }

  assert {
    condition     = strcontains(aws_iam_role_policy.funcion["notificador"].policy, "ses:SendEmail") && !strcontains(aws_iam_role_policy.funcion["notificador"].policy, "sns:Publish")
    error_message = "El notificador envía por SES y ya no necesita publicar en SNS."
  }

  assert {
    condition     = aws_lambda_function.funcion["normalizador"].environment[0].variables["URL_COLA_PROYECCION"] == var.urls_colas["proyeccion"] && strcontains(aws_iam_role_policy.funcion["normalizador"].policy, var.arns_colas["proyeccion"])
    error_message = "El normalizador pide reproyectar la ficha pública: necesita la URL y permiso para enviar a la cola de proyección."
  }

  assert {
    condition     = aws_lambda_function.funcion["proyector"].environment[0].variables["URL_COLA_PROYECCION"] == var.urls_colas["proyeccion"] && strcontains(aws_iam_role_policy.funcion["proyector"].policy, "sqs:SendMessage")
    error_message = "El proyector reencola las mascotas existentes en la recarga manual: necesita la URL y el permiso."
  }
}
