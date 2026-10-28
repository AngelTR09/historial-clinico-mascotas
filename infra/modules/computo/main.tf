# La API de Fastify con la MISMA imagen Docker de la fase local (documentación del proyecto §13), en
# ECS Fargate detrás de un ALB, con Application Auto Scaling. La TLS termina en
# CloudFront; el ALB solo acepta tráfico de CloudFront (grupo de seguridad con la lista
# de prefijos gestionada por AWS).

data "aws_region" "actual" {}

locals {
  nombre_servicio = "${var.nombre_proyecto}-api"
  registro_imagen = aws_ecr_repository.api.repository_url
}

# ---------- ECR ----------

resource "aws_ecr_repository" "api" {
  force_delete         = var.forzar_borrado
  name                 = "${var.nombre_proyecto}-api"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.arn_clave_datos
  }

  tags = var.etiquetas_comunes
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Conservar las ultimas 10 imagenes"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}

# ---------- Logs y cluster ----------

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.nombre_servicio}"
  retention_in_days = var.dias_logs
  kms_key_id        = var.arn_clave_datos

  tags = var.etiquetas_comunes
}

resource "aws_ecs_cluster" "principal" {
  name = "${var.nombre_proyecto}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.etiquetas_comunes
}

# ---------- IAM ----------

resource "aws_iam_role" "ejecucion" {
  name = "${local.nombre_servicio}-ejecucion"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  tags = var.etiquetas_comunes
}

resource "aws_iam_role_policy_attachment" "ejecucion" {
  role       = aws_iam_role.ejecucion.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ejecucion_secretos" {
  name = "leer-secretos-al-arrancar"
  role = aws_iam_role.ejecucion.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = "secretsmanager:GetSecretValue", Resource = var.arns_secretos },
      { Effect = "Allow", Action = "kms:Decrypt", Resource = var.arn_clave_datos },
    ]
  })
}

resource "aws_iam_role" "tarea" {
  name = "${local.nombre_servicio}-tarea"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  tags = var.etiquetas_comunes
}

# Permisos mínimos de la API: firmar subidas de evidencias, leer y escribir DynamoDB,
# encolar trabajo y descifrar con la clave de datos. Nunca recibe el binario (documentación del proyecto §12).
resource "aws_iam_role_policy" "tarea" {
  name = "permisos-de-la-api"
  role = aws_iam_role.tarea.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid      = "EvidenciasPorUrlFirmada"
          Effect   = "Allow"
          Action   = ["s3:PutObject", "s3:GetObject"]
          Resource = "${var.arn_bucket_evidencias}/*"
        },
        {
          Sid      = "TablasDynamoDB"
          Effect   = "Allow"
          Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"]
          Resource = var.arns_tablas_dynamodb
        },
        {
          Sid      = "EncolarTrabajo"
          Effect   = "Allow"
          Action   = "sqs:SendMessage"
          Resource = var.arns_colas
        },
        {
          Sid      = "ClaveDeDatos"
          Effect   = "Allow"
          Action   = ["kms:Decrypt", "kms:GenerateDataKey"]
          Resource = var.arn_clave_datos
        },
      ],
      # Solo si hay identidades: un Resource vacío invalidaría la política.
      length(var.arns_identidades_ses) == 0 ? [] : [{
        Sid      = "EnviarCorreo"
        Effect   = "Allow"
        Action   = "ses:SendEmail"
        Resource = var.arns_identidades_ses
      }],
      # Solo si hay temas: un Resource vacío invalidaría la política.
      length(var.arns_temas_sns) == 0 ? [] : [{
        Sid      = "PublicarNotificaciones"
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = var.arns_temas_sns
      }],
    )
  })
}

# ---------- Tarea y servicio ----------

resource "aws_ecs_task_definition" "api" {
  family                   = local.nombre_servicio
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memoria
  execution_role_arn       = aws_iam_role.ejecucion.arn
  task_role_arn            = aws_iam_role.tarea.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = var.arquitectura
  }

  volume {
    name = "tmp"
  }

  container_definitions = jsonencode([{
    name                   = "api"
    image                  = "${local.registro_imagen}:${var.etiqueta_imagen}"
    essential              = true
    readonlyRootFilesystem = true
    portMappings           = [{ containerPort = 3000, protocol = "tcp" }]
    mountPoints            = [{ sourceVolume = "tmp", containerPath = "/tmp", readOnly = false }]
    environment            = [for nombre, valor in var.variables_entorno : { name = nombre, value = valor }]
    secrets                = [for nombre, arn in var.secretos_entorno : { name = nombre, valueFrom = arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = data.aws_region.actual.name
        awslogs-stream-prefix = "api"
      }
    }
  }])

  tags = var.etiquetas_comunes
}

# ---------- ALB ----------

# aws-elb-alb-not-public: El ALB es el origen de CloudFront y debe ser alcanzable por internet; su grupo de seguridad solo admite la lista de prefijos gestionada de CloudFront.
#tfsec:ignore:aws-elb-alb-not-public
resource "aws_lb" "api" {
  #checkov:skip=CKV_AWS_150:deletion_protection lo controla proteccion_alb: true en prod, false en dev para poder hacer destroy
  #checkov:skip=CKV2_AWS_20:La TLS termina en CloudFront; el ALB solo es alcanzable desde la lista de prefijos de CloudFront
  #checkov:skip=CKV2_AWS_28:WAF diferido: se enciende solo en la demostracion de seguridad (cobra por regla) y va delante de CloudFront
  #checkov:skip=CKV_AWS_91:Sin logs de acceso del ALB: CloudFront ya los registra y el volumen en S3 no tiene RNF que lo pida
  name                       = "${var.nombre_proyecto}-alb"
  load_balancer_type         = "application"
  internal                   = false
  subnets                    = var.ids_subredes_publicas
  security_groups            = [var.id_sg_alb]
  drop_invalid_header_fields = true
  enable_deletion_protection = var.proteccion_alb

  tags = var.etiquetas_comunes
}

resource "aws_lb_target_group" "api" {
  #checkov:skip=CKV_AWS_378:Trafico HTTP interno entre el ALB y las tareas dentro de la VPC; la TLS termina en CloudFront
  name                 = "${var.nombre_proyecto}-api"
  port                 = 3000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.id_vpc
  deregistration_delay = 30

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
  }

  tags = var.etiquetas_comunes
}

# aws-elb-http-not-used: Compromiso de costo del PMV (documentación del proyecto §18): sin dominio propio no hay certificado ACM para el ALB. La TLS termina en CloudFront y el ALB solo admite la lista de prefijos de CloudFront.
#tfsec:ignore:aws-elb-http-not-used
resource "aws_lb_listener" "http" {
  #checkov:skip=CKV_AWS_2:La TLS termina en CloudFront; el ALB solo es alcanzable desde la lista de prefijos de CloudFront
  #checkov:skip=CKV_AWS_103:Sin listener HTTPS: no hay dominio propio ni certificado ACM en el PMV
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  tags = var.etiquetas_comunes
}

resource "aws_ecs_service" "api" {
  #checkov:skip=CKV_AWS_333:Las tareas necesitan IP publica para llegar a las APIs de AWS sin NAT Gateway (documentación del proyecto.md §11); el grupo de seguridad solo admite trafico del ALB
  name            = local.nombre_servicio
  cluster         = aws_ecs_cluster.principal.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.tareas_minimas
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 60

  # Si una versión rota no se estabiliza, ECS vuelve sola a la anterior.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.ids_subredes_publicas
    security_groups  = [var.id_sg_api]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  # El autoescalado cambia desired_count y el despliegue de CI (deploy-api.yml) registra
  # revisiones nuevas de la tarea con la imagen del commit: Terraform no debe revertirlos.
  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  depends_on = [aws_lb_listener.http]

  tags = var.etiquetas_comunes
}

# ---------- Application Auto Scaling ----------

resource "aws_appautoscaling_target" "api" {
  service_namespace  = "ecs"
  scalable_dimension = "ecs:service:DesiredCount"
  resource_id        = "service/${aws_ecs_cluster.principal.name}/${aws_ecs_service.api.name}"
  min_capacity       = var.tareas_minimas
  max_capacity       = var.tareas_maximas
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${local.nombre_servicio}-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  resource_id        = aws_appautoscaling_target.api.resource_id

  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_out_cooldown = 60
    scale_in_cooldown  = 300

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "solicitudes" {
  name               = "${local.nombre_servicio}-solicitudes"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  resource_id        = aws_appautoscaling_target.api.resource_id

  target_tracking_scaling_policy_configuration {
    target_value       = var.solicitudes_por_tarea
    scale_out_cooldown = 60
    scale_in_cooldown  = 300

    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.api.arn_suffix}/${aws_lb_target_group.api.arn_suffix}"
    }
  }
}
