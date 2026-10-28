mock_provider "aws" {}

run "clave_rota_y_tres_secretos_sin_valores" {
  command = plan

  variables {
    parametros = { "OCR_ENABLED" = "false" }
  }

  assert {
    condition     = aws_kms_key.datos.enable_key_rotation
    error_message = "La clave de datos debe rotar sola."
  }

  assert {
    condition     = length(aws_secretsmanager_secret.api) == 3
    error_message = "Deben existir los tres secretos de la API."
  }

  assert {
    condition     = aws_ssm_parameter.configuracion["OCR_ENABLED"].value == "false"
    error_message = "OCR_ENABLED debe quedar en false (documentación del proyecto §11)."
  }
}
