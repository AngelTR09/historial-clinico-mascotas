mock_provider "aws" {}

variables {
  dns_alb                  = "hcm-alb-123.us-east-1.elb.amazonaws.com"
  nombre_bucket_evidencias = "hcm-evidencias-123456789012"
}

run "https_obligatorio_api_sin_cache_y_ficha_con_cache_corta" {
  command = plan

  assert {
    condition     = aws_cloudfront_distribution.principal.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "Todo el tráfico debe ir por HTTPS (RNF 18 del plan de seguridad)."
  }

  assert {
    condition     = aws_cloudfront_cache_policy.ficha_publica.default_ttl == 30 && aws_cloudfront_cache_policy.ficha_publica.max_ttl <= 60
    error_message = "La ficha pública se cachea como máximo 60 s."
  }

  assert {
    condition     = length(aws_cloudfront_distribution.principal.ordered_cache_behavior) == 2
    error_message = "Debe haber un comportamiento para la ficha pública y otro para el resto de la API."
  }

  assert {
    condition     = alltrue([for x in [aws_s3_bucket_public_access_block.web.block_public_acls, aws_s3_bucket_public_access_block.web.block_public_policy, aws_s3_bucket_public_access_block.web.restrict_public_buckets] : x])
    error_message = "El bucket de la web debe ser privado: solo CloudFront lo lee."
  }
}

run "no_fuerza_el_borrado_por_defecto" {
  command = plan

  assert {
    condition     = aws_s3_bucket.web.force_destroy == false
    error_message = "Por defecto el destroy no debe borrar con contenido: solo dev lo activa."
  }
}

run "dev_puede_forzar_el_borrado" {
  command = plan

  variables {
    forzar_borrado = true
  }

  assert {
    condition     = aws_s3_bucket.web.force_destroy == true
    error_message = "Con forzar_borrado el destroy debe poder borrar con contenido (dev)."
  }
}
