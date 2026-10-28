mock_provider "aws" {}

variables {
  arn_clave_datos       = "arn:aws:kms:us-east-1:123456789012:key/11111111-2222-3333-4444-555555555555"
  ids_subredes_privadas = ["subnet-aaa", "subnet-bbb"]
  id_sg_db              = "sg-123"
}

run "base_cifrada_privada_y_sin_multi_az_por_defecto" {
  command = plan

  assert {
    condition     = aws_db_instance.principal.storage_encrypted && !aws_db_instance.principal.publicly_accessible
    error_message = "RDS debe estar cifrada y no ser pública (RNF 13)."
  }

  assert {
    condition     = aws_db_instance.principal.multi_az == false
    error_message = "Multi-AZ debe estar apagado por defecto (decisión de costo)."
  }

  assert {
    condition     = aws_db_instance.principal.backup_retention_period >= 1 && aws_db_instance.principal.deletion_protection
    error_message = "Debe haber respaldo automático (RPO) y protección contra borrado por defecto."
  }

  assert {
    condition     = aws_dynamodb_table.perfil_publico.hash_key == "qr_token"
    error_message = "La ficha pública se indexa por qr_token."
  }

  assert {
    condition     = contains(flatten([for r in aws_s3_bucket_lifecycle_configuration.evidencias.rule : [for t in r.transition : t.storage_class]]), "GLACIER_IR")
    error_message = "Las evidencias pasan a Glacier Instant Retrieval."
  }
}

run "multi_az_se_enciende_por_variable" {
  command = plan

  variables {
    multi_az = true
  }

  assert {
    condition     = aws_db_instance.principal.multi_az
    error_message = "La variable multi_az debe encender la réplica."
  }
}

run "no_fuerza_el_borrado_por_defecto" {
  command = plan

  assert {
    condition     = aws_s3_bucket.evidencias.force_destroy == false
    error_message = "Por defecto el destroy no debe borrar con contenido: solo dev lo activa."
  }
}

run "dev_puede_forzar_el_borrado" {
  command = plan

  variables {
    forzar_borrado = true
  }

  assert {
    condition     = aws_s3_bucket.evidencias.force_destroy == true
    error_message = "Con forzar_borrado el destroy debe poder borrar con contenido (dev)."
  }
}

run "el_parametro_de_ssl_usa_el_metodo_que_aws_informa" {
  command = plan

  assert {
    condition     = one([for p in aws_db_parameter_group.postgres.parameter : p if p.name == "rds.force_ssl"]).apply_method == "pending-reboot" && one([for p in aws_db_parameter_group.postgres.parameter : p if p.name == "rds.force_ssl"]).value == "1"
    error_message = "rds.force_ssl debe seguir en 1, con el apply_method que AWS devuelve (pending-reboot) para no mostrar cambios falsos."
  }
}
