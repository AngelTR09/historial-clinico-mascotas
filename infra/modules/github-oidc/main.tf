# GitHub Actions entra a AWS por OIDC, sin claves de larga vida (documentación del proyecto §13 del plan,
# fase 0). Dos roles:
#   - plan:  solo lectura; lo asume cualquier pull_request del repositorio.
#   - apply: permisos amplios; solo lo asume la rama protegida.

data "aws_caller_identity" "actual" {}

locals {
  arn_proveedor = "arn:aws:iam::${data.aws_caller_identity.actual.account_id}:oidc-provider/token.actions.githubusercontent.com"

  # Un job que declara `environment:` recibe de GitHub un `sub` distinto
  # (repo:<org>/<repo>:environment:<nombre>) y deja de coincidir con la rama o el
  # pull_request. Los workflows de despliegue usan environments (Pendiente_Integrar/github-actions/GITHUB-ACTIONS.md),
  # así que se aceptan los nombres explícitos de esas variables y ninguno más.
  subs_plan = concat(
    ["repo:${var.repositorio_github}:pull_request"],
    [for e in var.entornos_plan : "repo:${var.repositorio_github}:environment:${e}"],
  )
  subs_apply = concat(
    ["repo:${var.repositorio_github}:ref:refs/heads/${var.rama_apply}"],
    [for e in var.entornos_apply : "repo:${var.repositorio_github}:environment:${e}"],
  )
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.crear_proveedor_oidc ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]

  tags = var.etiquetas_comunes
}

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
          "token.actions.githubusercontent.com:sub" = local.subs_plan
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

# aws-iam-no-policy-wildcards: El comodín solo aparece en sentencias Deny (negar la lectura de secretos al rol de plan); no concede nada.
#tfsec:ignore:aws-iam-no-policy-wildcards
resource "aws_iam_role_policy" "plan_estado" {
  name = "estado-de-terraform"
  role = aws_iam_role.plan.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "LeerEstado"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [var.arn_bucket_estado, "${var.arn_bucket_estado}/*"]
      },
      {
        Sid      = "BloquearEstado"
        Effect   = "Allow"
        Action   = ["dynamodb:DescribeTable", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        Resource = var.arn_tabla_bloqueo
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
        Sid      = "NoLeerSecretos"
        Effect   = "Deny"
        Action   = ["secretsmanager:GetSecretValue", "ssm:GetParameter*"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_role" "apply" {
  name                 = "${var.nombre_proyecto}-github-apply"
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
          "token.actions.githubusercontent.com:sub" = local.subs_apply
        }
      }
    }]
  })

  tags = var.etiquetas_comunes
}

resource "aws_iam_role_policy_attachment" "apply" {
  role       = aws_iam_role.apply.name
  policy_arn = var.arn_politica_apply
}
