# Cognito reemplaza al AuthPort local (RNF 03 y 06): emite tokens con vencimiento y el
# registro se confirma con un código enviado por correo, igual que el login local.
# Que un veterinario esté aprobado lo sigue decidiendo la API (ADR 0006).

resource "aws_cognito_user_pool" "principal" {
  name                     = "${var.nombre_proyecto}-usuarios"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "OFF"
  deletion_protection      = var.proteccion_contra_borrado

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 3
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = var.etiquetas_comunes
}

resource "aws_cognito_user_group" "grupo" {
  for_each = var.grupos

  name         = each.key
  description  = each.value
  user_pool_id = aws_cognito_user_pool.principal.id
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.nombre_proyecto}-web"
  user_pool_id = aws_cognito_user_pool.principal.id

  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  explicit_auth_flows           = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}
