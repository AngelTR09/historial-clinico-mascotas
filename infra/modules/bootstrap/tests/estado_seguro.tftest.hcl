# Corre sin credenciales ni cuenta AWS: `terraform test` con proveedor simulado.
mock_provider "aws" {}

run "estado_cifrado_versionado_y_privado" {
  command = plan

  assert {
    condition     = aws_kms_key.estado.enable_key_rotation
    error_message = "La clave del estado debe rotar automáticamente."
  }

  assert {
    condition     = aws_s3_bucket_versioning.estado.versioning_configuration[0].status == "Enabled"
    error_message = "El bucket de estado debe estar versionado."
  }

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.estado.block_public_acls,
      aws_s3_bucket_public_access_block.estado.block_public_policy,
      aws_s3_bucket_public_access_block.estado.ignore_public_acls,
      aws_s3_bucket_public_access_block.estado.restrict_public_buckets,
    ])
    error_message = "El bucket de estado no puede tener ningún acceso público."
  }

  assert {
    condition     = strcontains(aws_s3_bucket.estado.bucket, "-tfstate-")
    error_message = "El bucket de estado lleva el nombre del proyecto."
  }
}

run "el_nombre_del_bucket_incluye_la_region" {
  command = plan

  override_data {
    target = data.aws_region.actual
    values = {
      name = "us-east-2"
    }
  }

  assert {
    condition     = endswith(aws_s3_bucket.estado.bucket, "-us-east-2")
    error_message = "El bucket de estado debe llevar la región en el nombre."
  }
}

run "rechaza_retencion_corta" {
  command = plan

  variables {
    dias_retencion_versiones_antiguas = 7
  }

  expect_failures = [var.dias_retencion_versiones_antiguas]
}
