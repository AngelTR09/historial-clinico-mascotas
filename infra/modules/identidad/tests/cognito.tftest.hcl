mock_provider "aws" {}

run "tokens_cortos_grupos_y_codigo_por_correo" {
  command = plan

  assert {
    condition     = aws_cognito_user_pool_client.web.access_token_validity == 60 && aws_cognito_user_pool_client.web.token_validity_units[0].access_token == "minutes"
    error_message = "El token de acceso debe vencer en 60 minutos (RNF 06)."
  }

  assert {
    condition     = length(aws_cognito_user_group.grupo) == 3
    error_message = "Deben existir los grupos duenos, veterinarios y albergues."
  }

  assert {
    condition     = aws_cognito_user_pool.principal.verification_message_template[0].default_email_option == "CONFIRM_WITH_CODE" && contains(aws_cognito_user_pool.principal.auto_verified_attributes, "email")
    error_message = "La cuenta se activa con un código enviado por correo."
  }
}
