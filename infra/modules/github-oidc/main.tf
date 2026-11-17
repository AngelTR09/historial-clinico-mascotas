# GitHub Actions se conecta a AWS mediante OIDC, sin guardar claves de acceso permanentes.
# Se utilizan dos roles:
# - Plan: permite validar los cambios de los pull requests con terraform plan.
# - Despliegue: solo puede asumirlo un job que utilice el GitHub Environment configurado,
#   previsto para dev y restringido a la rama development desde GitHub.
# El despliegue no utiliza AdministratorAccess. Sus permisos se definen en una política
# propia que limita los servicios, la región y los recursos del proyecto.

data "aws_caller_identity" "actual" {}

locals {
  # GitHub emite el `sub` con el identificador inmutable del repositorio cuando este lo tiene activado
  # (repo:<dueño>@<id>/<repo>@<id>): así un repositorio renombrado o recreado con el mismo nombre no hereda el
  # acceso. Se confía en UN solo prefijo: el que se pasa en prefijo_sub_github o, si va vacío, el clásico por nombre.
  prefijo_sub = var.prefijo_sub_github != "" ? var.prefijo_sub_github : "repo:${var.repositorio_github}"

  cuenta        = data.aws_caller_identity.actual.account_id
  arn_proveedor = "arn:aws:iam::${local.cuenta}:oidc-provider/token.actions.githubusercontent.com"

  # El plan de los pull requests lee el estado de todos los entornos; el despliegue solo el de su prefijo.
  raiz_estado = split("/", var.prefijo_estado)[0]

  # Las únicas políticas administradas de AWS que Terraform puede adjuntar a los roles del proyecto.
  politicas_adjuntables = [
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
    "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup",
    "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores",
  ]

  roles_del_proyecto = "arn:aws:iam::${local.cuenta}:role/${var.nombre_proyecto}-*"
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.crear_proveedor_oidc ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]

  tags = var.etiquetas_comunes
}

# Rol de plan (pull requests)

resource "aws_iam_role" "plan" {
  name                 = "${var.nombre_proyecto}-github-plan"
  max_session_duration = 3600

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = local.arn_proveedor }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = ["${local.prefijo_sub}:pull_request"]
        }
      }
    }]
  })

  tags = var.etiquetas_comunes
}

resource "aws_iam_role_policy_attachment" "plan_lectura" {
  role       = aws_iam_role.plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# aws-iam-no-policy-wildcards: El comodín solo aparece en sentencias Deny (negar la lectura de secretos al rol de plan) y en el prefijo del estado; no concede nada fuera de ahí.
#tfsec:ignore:aws-iam-no-policy-wildcards
resource "aws_iam_role_policy" "plan_estado" {
  name = "estado-de-terraform"
  role = aws_iam_role.plan.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "ListarEstado"
        Effect    = "Allow"
        Action    = "s3:ListBucket"
        Resource  = var.arn_bucket_estado
        Condition = { StringLike = { "s3:prefix" = [local.raiz_estado, "${local.raiz_estado}/*"] } }
      },
      {
        Sid      = "LeerEstado"
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${var.arn_bucket_estado}/${local.raiz_estado}/*"
      },
      # use_lockfile bloquea el estado con un objeto <clave>.tflock dentro del mismo bucket: el plan
      # solo puede escribir y borrar esos archivos, nunca el estado ni otro objeto.
      {
        Sid      = "BloquearEstadoConArchivo"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${var.arn_bucket_estado}/${local.raiz_estado}/*.tflock"
      },
      {
        Sid      = "DescifrarEstado"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:DescribeKey", "kms:GenerateDataKey"]
        Resource = var.arn_clave_estado
      },
      # ReadOnlyAccess incluye s3:Get*: se niega la lectura de las evidencias y de los
      # secretos para que un pull_request nunca pueda leer datos de mascotas ni claves.
      {
        Sid      = "NoLeerEvidencias"
        Effect   = "Deny"
        Action   = "s3:GetObject"
        Resource = "arn:aws:s3:::${var.nombre_proyecto}-evidencias-*/*"
      },
      {
        Sid      = "NoLeerValoresDeSecretos"
        Effect   = "Deny"
        Action   = "secretsmanager:GetSecretValue"
        Resource = "*"
      },
      # Terraform necesita leer los parámetros de configuración del proyecto (no secretos) para refrescar su estado;
      # cualquier otro parámetro de SSM sigue vedado.
      {
        Sid         = "NoLeerOtrosParametros"
        Effect      = "Deny"
        Action      = "ssm:GetParameter*"
        NotResource = "arn:aws:ssm:*:${local.cuenta}:parameter/${var.nombre_proyecto}/*"
      },
    ]
  })
}

# Rol de despliegue (environment dev)

resource "aws_iam_role" "despliegue" {
  name                 = var.nombre_rol_despliegue
  max_session_duration = 3600

  # Un job que declara `environment: dev` recibe de GitHub el sub <prefijo>:environment:dev. Es el único que se
  # acepta: sin comodines y sin el formato de rama (ref:refs/heads/...), que dejaría entrar a cualquier job de esa rama.
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = local.arn_proveedor }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "${local.prefijo_sub}:environment:${var.entorno_despliegue}"
        }
      }
    }]
  })

  tags = var.etiquetas_comunes
}

# aws-iam-no-policy-wildcards: Las acciones terminan en :* por servicio porque Terraform crea, lee, actualiza y borra cada recurso del stack; el límite está en la región, en los ARN de los roles y buckets del proyecto y en el prefijo del estado.
#tfsec:ignore:aws-iam-no-policy-wildcards
resource "aws_iam_policy" "despliegue" {
  #checkov:skip=CKV_AWS_289:Terraform crea roles IAM del proyecto; se limita a roles del proyecto y a cinco políticas administradas concretas
  #checkov:skip=CKV_AWS_290:Terraform escribe en los servicios del stack; el límite es la región, los ARN del proyecto y el prefijo del estado
  #checkov:skip=CKV_AWS_355:Crear recursos de red, balanceador o clave KMS no admite restringir por ARN; se limita por servicio y por región
  #checkov:skip=CKV_AWS_286:La escalada de privilegios de IAM se acota a roles hcm-* y a una lista cerrada de políticas administradas
  #checkov:skip=CKV_AWS_287:Sin permisos de credenciales de IAM: solo roles del proyecto
  #checkov:skip=CKV_AWS_288:Sin acceso a datos del estado fuera de su prefijo; las lecturas amplias son las de refresco de Terraform
  #checkov:skip=CKV_AWS_63:Las acciones usan comodín por servicio; el límite es la región, el ARN y el prefijo del estado
  name        = "${var.nombre_rol_despliegue}-terraform"
  description = "Terraform del entorno dev: servicios del stack en una región, roles y buckets del proyecto, estado bajo su prefijo."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [

      # El rol de despliegue puede leer y actualizar el estado de su entorno,
      # además de crear y eliminar su archivo de bloqueo.

      {
        Sid       = "ListarEstadoDelPrefijo"
        Effect    = "Allow"
        Action    = "s3:ListBucket"
        Resource  = var.arn_bucket_estado
        Condition = { StringLike = { "s3:prefix" = [var.prefijo_estado, "${var.prefijo_estado}/*"] } }
      },
      {
        Sid      = "LeerYEscribirElEstado"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${var.arn_bucket_estado}/${var.prefijo_estado}/terraform.tfstate"
      },
      {
        Sid      = "CrearYBorrarElArchivoDeBloqueo"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${var.arn_bucket_estado}/${var.prefijo_estado}/terraform.tfstate.tflock"
      },
      {
        Sid      = "ClaveDelEstado"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
        Resource = var.arn_clave_estado
      },

      # Se permite administrar los buckets de la web y de evidencias del proyecto,
      # sin incluir el bucket utilizado para guardar el estado de Terraform.

      {
        Sid      = "BucketsDelProyecto"
        Effect   = "Allow"
        Action   = "s3:*"
        Resource = [for b in ["web", "evidencias"] : "arn:aws:s3:::${var.nombre_proyecto}-${b}-*"]
      },
      {
        Sid      = "ObjetosDeLosBucketsDelProyecto"
        Effect   = "Allow"
        Action   = "s3:*"
        Resource = [for b in ["web", "evidencias"] : "arn:aws:s3:::${var.nombre_proyecto}-${b}-*/*"]
      },
      # Los permisos de los servicios regionales se limitan a la región
      {
        Sid    = "ServiciosRegionalesDelStack"
        Effect = "Allow"
        Action = [
          "ec2:*", "ecs:*", "ecr:*", "elasticloadbalancing:*", "rds:*", "sqs:*", "sns:*", "lambda:*",
          "cognito-idp:*", "kms:*", "secretsmanager:*", "ssm:*", "logs:*", "cloudwatch:*", "events:*",
          "application-autoscaling:*", "backup:*", "backup-storage:*", "dynamodb:*", "ses:*",
        ]
        Resource  = "*"
        Condition = { StringEquals = { "aws:RequestedRegion" = var.region } }
      },
      # CloudFront es un servicio global
      {
        Sid      = "CloudFront"
        Effect   = "Allow"
        Action   = "cloudfront:*"
        Resource = "*"
      },

      # Los permisos de IAM se aplican a los roles del proyecto.
      # Solo se pueden adjuntar o quitar las políticas administradas permitidas.

      {
        Sid    = "RolesDelProyecto"
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole", "iam:UpdateAssumeRolePolicy",
          "iam:TagRole", "iam:UntagRole", "iam:PutRolePolicy", "iam:GetRolePolicy", "iam:DeleteRolePolicy",
          "iam:ListRolePolicies", "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole", "iam:ListRoleTags",
        ]
        Resource = local.roles_del_proyecto
      },
      {
        Sid       = "AdjuntarSoloPoliticasPermitidas"
        Effect    = "Allow"
        Action    = ["iam:AttachRolePolicy", "iam:DetachRolePolicy"]
        Resource  = local.roles_del_proyecto
        Condition = { ArnEquals = { "iam:PolicyARN" = local.politicas_adjuntables } }
      },
      {
        Sid       = "PasarRolesSoloAEcsLambdaYBackup"
        Effect    = "Allow"
        Action    = "iam:PassRole"
        Resource  = local.roles_del_proyecto
        Condition = { StringEquals = { "iam:PassedToService" = ["ecs-tasks.amazonaws.com", "lambda.amazonaws.com", "backup.amazonaws.com"] } }
      },
      {
        Sid      = "RolesVinculadosAServicios"
        Effect   = "Allow"
        Action   = "iam:CreateServiceLinkedRole"
        Resource = "arn:aws:iam::${local.cuenta}:role/aws-service-role/*"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "despliegue" {
  role       = aws_iam_role.despliegue.name
  policy_arn = aws_iam_policy.despliegue.arn
}
