# Borde: la web estática en S3 privado (OAC) y la API detrás de UNA sola distribución de
# CloudFront con HTTPS en su dominio por defecto (no hace falta Route 53 ni ACM en el PMV).
#   /api/public/*  -> ALB, con caché corta (ficha pública, RNF 02)
#   /api/*         -> ALB, sin caché (el prefijo /api se quita en el borde)
#   resto          -> S3 (SPA)
# La web se construye con VITE_API_URL=/api.

data "aws_caller_identity" "actual" {}

locals {
  # Políticas gestionadas por AWS (identificadores fijos y documentados).
  cache_optimizada       = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  cache_deshabilitada    = "4135ea2d-6df9-4a1b-9a2b-0f6e1f6ab4fa"
  origen_todo_menos_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  cabeceras_seguras      = "67f7725c-6f97-4210-82d7-5512b31e9d03"
}

# aws-s3-enable-bucket-logging: Sin logs de acceso: CloudFront es el único lector y el contenido es público.
#tfsec:ignore:aws-s3-enable-bucket-logging
resource "aws_s3_bucket" "web" {
  force_destroy = var.forzar_borrado
  #checkov:skip=CKV_AWS_18:Sin logs de acceso: CloudFront es el unico lector y sirve contenido publico
  #checkov:skip=CKV_AWS_144:Sin replicacion: el build se regenera desde el repositorio
  #checkov:skip=CKV_AWS_145:SSE-S3 basta: son archivos estaticos publicos; con KMS el OAC exigiria permisos extra en la clave
  #checkov:skip=CKV2_AWS_62:Sin notificaciones de eventos: ningun consumidor
  bucket = "${var.nombre_proyecto}-web-${data.aws_caller_identity.actual.account_id}"

  tags = var.etiquetas_comunes
}

resource "aws_s3_bucket_versioning" "web" {
  bucket = aws_s3_bucket.web.id

  versioning_configuration {
    status = "Enabled"
  }
}

# aws-s3-encryption-customer-key: Son archivos estáticos públicos del build: con KMS propia el OAC de CloudFront exigiría permisos extra en la clave. SSE-S3 basta.
#tfsec:ignore:aws-s3-encryption-customer-key
resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    id     = "expirar-versiones-antiguas"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.web]
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${var.nombre_proyecto}-web"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Reescribe las rutas de la SPA (/pets/123, /p/abc) a /index.html. Solo en el
# comportamiento por defecto: así los 404 de la API siguen siendo 404 con JSON.
resource "aws_cloudfront_function" "spa" {
  name    = "${var.nombre_proyecto}-spa"
  runtime = "cloudfront-js-2.0"
  publish = true
  comment = "Rutas de la SPA a index.html"
  code    = <<-JS
    function handler(event) {
      var solicitud = event.request;
      if (solicitud.uri.indexOf('.') === -1) {
        solicitud.uri = '/index.html';
      }
      return solicitud;
    }
  JS
}

# El front llama a /api/...; la API no conoce ese prefijo.
resource "aws_cloudfront_function" "quitar_prefijo_api" {
  name    = "${var.nombre_proyecto}-quitar-prefijo-api"
  runtime = "cloudfront-js-2.0"
  publish = true
  comment = "Quita /api antes de llegar al ALB"
  code    = <<-JS
    function handler(event) {
      var solicitud = event.request;
      solicitud.uri = solicitud.uri.replace(/^\/api/, '') || '/';
      return solicitud;
    }
  JS
}

# Ficha pública: caché de 30 s. Los GET se absorben en CloudFront; los POST (contacto) no se cachean.
resource "aws_cloudfront_cache_policy" "ficha_publica" {
  name        = "${var.nombre_proyecto}-ficha-publica"
  comment     = "Ficha publica por QR: cache corta"
  default_ttl = 30
  min_ttl     = 0
  max_ttl     = 60

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# aws-cloudfront-use-secure-tls-policy: Sin dominio propio la distribución usa el certificado por defecto de CloudFront, que no permite fijar la política TLS mínima.
# aws-cloudfront-enable-logging: Sin logs de acceso de CloudFront en el PMV: costo y mantenimiento sin RNF que los pida (documentación del proyecto §18).
#tfsec:ignore:aws-cloudfront-use-secure-tls-policy
#tfsec:ignore:aws-cloudfront-enable-logging
resource "aws_cloudfront_distribution" "principal" {
  #checkov:skip=CKV2_AWS_42:Sin dominio propio la distribucion usa el certificado por defecto de CloudFront
  #checkov:skip=CKV2_AWS_47:WAF diferido: cuando se conecte arn_waf se le agregan las reglas gestionadas
  #checkov:skip=CKV_AWS_68:WAF diferido: se enciende solo en la demostracion de seguridad (costo por regla); la variable arn_waf lo conecta
  #checkov:skip=CKV_AWS_86:Sin logs de acceso de CloudFront en el PMV: costo y mantenimiento sin RNF que los pida
  #checkov:skip=CKV_AWS_174:Sin dominio propio la distribucion usa el certificado por defecto, que no permite fijar TLS minimo
  #checkov:skip=CKV2_AWS_32:Las cabeceras de seguridad se aplican con la politica gestionada SecurityHeadersPolicy
  #checkov:skip=CKV_AWS_310:Sin origen de respaldo: la disponibilidad la da el ALB en dos zonas
  #checkov:skip=CKV_AWS_374:Sin restriccion geografica: los dueños pueden consultar desde cualquier pais
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.nombre_proyecto}: web y API"
  default_root_object = "index.html"
  price_class         = var.clase_de_precio
  web_acl_id          = var.arn_waf

  origin {
    origin_id                = "web"
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    origin_id   = "api"
    domain_name = var.dns_alb

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id           = "web"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_optimizada
    response_headers_policy_id = local.cabeceras_seguras

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa.arn
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/api/public/*"
    target_origin_id           = "api"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.ficha_publica.id
    origin_request_policy_id   = local.origen_todo_menos_host
    response_headers_policy_id = local.cabeceras_seguras

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.quitar_prefijo_api.arn
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/api/*"
    target_origin_id           = "api"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.cache_deshabilitada
    origin_request_policy_id   = local.origen_todo_menos_host
    response_headers_policy_id = local.cabeceras_seguras

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.quitar_prefijo_api.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = var.etiquetas_comunes
}

# Solo esta distribución puede leer el bucket de la web; y siempre con TLS.
resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "LecturaSoloDesdeCloudFront"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.web.arn}/*"
        Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.principal.arn } }
      },
      {
        Sid       = "SoloConTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.web.arn, "${aws_s3_bucket.web.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.web]
}

# La subida de evidencias es por URL firmada directo a S3 desde el navegador: el bucket
# debe aceptar PUT desde el origen de la web (este módulo es el que conoce ese dominio).
resource "aws_s3_bucket_cors_configuration" "evidencias" {
  bucket = var.nombre_bucket_evidencias

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = ["https://${aws_cloudfront_distribution.principal.domain_name}"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}
