# Este entorno solo llama módulos de ../../modules (documentación del proyecto §9: sin recursos sueltos).
# dev y prod tienen la misma estructura; solo cambian las protecciones (local.proteger).

locals {
  etiquetas = {
    Project = "hcm"
    Env     = "prod"
    Owner   = var.owner
  }

  # dev se puede destruir sin snapshot ni protecciones; prod nunca (deletion_protection y snapshot final).
  proteger = true
}

module "red" {
  source = "../../modules/network"

  etiquetas_comunes = local.etiquetas
}

module "seguridad" {
  source = "../../modules/seguridad"

  etiquetas_comunes          = local.etiquetas
  dias_recuperacion_secretos = local.proteger ? 7 : 0

  # OCR_ENABLED=false por defecto en TODOS los entornos (documentación del proyecto §11).
  parametros = {
    OCR_ENABLED = "false"
  }
}

module "datos" {
  source = "../../modules/datos"

  etiquetas_comunes         = local.etiquetas
  arn_clave_datos           = module.seguridad.arn_clave_datos
  ids_subredes_privadas     = module.red.ids_subredes_privadas
  id_sg_db                  = module.red.id_sg_db
  multi_az                  = var.multi_az
  proteccion_contra_borrado = local.proteger
  omitir_snapshot_final     = !local.proteger
}

module "mensajeria" {
  source = "../../modules/mensajeria"

  etiquetas_comunes = local.etiquetas
  arn_clave_datos   = module.seguridad.arn_clave_datos
  correos_alerta    = var.correos_alerta

  correo_remitente   = var.correo_remitente
  correos_ses_prueba = var.correos_ses_prueba
}

module "identidad" {
  source = "../../modules/identidad"

  etiquetas_comunes         = local.etiquetas
  proteccion_contra_borrado = local.proteger ? "ACTIVE" : "INACTIVE"
}

module "computo" {
  source = "../../modules/computo"

  etiquetas_comunes     = local.etiquetas
  id_vpc                = module.red.id_vpc
  ids_subredes_publicas = module.red.ids_subredes_publicas
  id_sg_alb             = module.red.id_sg_alb
  id_sg_api             = module.red.id_sg_api
  arn_clave_datos       = module.seguridad.arn_clave_datos
  etiqueta_imagen       = var.etiqueta_imagen
  tareas_minimas        = var.tareas_minimas
  proteccion_alb        = local.proteger

  arn_bucket_evidencias = module.datos.arn_bucket_evidencias
  arns_tablas_dynamodb  = [module.datos.arn_tabla_perfil_publico]
  arns_colas            = values(module.mensajeria.arns_colas)
  arns_secretos         = concat(values(module.seguridad.arns_secretos_api), [module.datos.arn_secreto_bd])
  arns_identidades_ses  = module.mensajeria.arns_identidades_ses

  # config.js arma DATABASE_URL desde DB_* (DB_USER y DB_PASSWORD llegan como secretos) y,
  # con PROVEEDOR=aws, exige el bucket, la tabla, el tema y la cola que se pasan aquí.
  variables_entorno = {
    PROVEEDOR              = "aws"
    PORT                   = "3000"
    OCR_ENABLED            = "false"
    DB_HOST                = module.datos.direccion_rds
    DB_PORT                = "5432"
    DB_NAME                = "hcm"
    TABLA_PERFIL_PUBLICO   = module.datos.nombre_tabla_perfil_publico
    BUCKET_EVIDENCIAS      = module.datos.nombre_bucket_evidencias
    COGNITO_GRUPO          = module.identidad.id_grupo_usuarios
    COGNITO_CLIENTE        = module.identidad.id_cliente_web
    COGNITO_EMISOR         = module.identidad.emisor
    CORREO_REMITENTE       = var.correo_remitente
    URL_COLA_NORMALIZACION = module.mensajeria.urls_colas["normalizacion"]
    URL_COLA_PROYECCION    = module.mensajeria.urls_colas["proyeccion"]
  }

  # La autenticación sigue siendo el JWT local hasta el paso de Cognito: se firma con el
  # secreto reservado al acceso del veterinario (RN 10).
  secretos_entorno = {
    DOC_ENCRYPTION_KEY = module.seguridad.arns_secretos_api["doc-encryption-key"]
    DOC_HMAC_PEPPER    = module.seguridad.arns_secretos_api["doc-hmac-pepper"]
    JWT_SECRET         = module.seguridad.arns_secretos_api["firma-acceso-vet"]
    DB_USER            = "${module.datos.arn_secreto_bd}:username::"
    DB_PASSWORD        = "${module.datos.arn_secreto_bd}:password::"
  }
}

module "borde" {
  source = "../../modules/borde"

  etiquetas_comunes        = local.etiquetas
  dns_alb                  = module.computo.dns_alb
  nombre_bucket_evidencias = module.datos.nombre_bucket_evidencias
}

module "trabajadores" {
  source = "../../modules/trabajadores"

  etiquetas_comunes           = local.etiquetas
  ids_subredes_privadas       = module.red.ids_subredes_privadas
  id_sg_funciones             = module.red.id_sg_funciones
  arn_clave_datos             = module.seguridad.arn_clave_datos
  directorio_paquetes         = "${path.root}/../../../workers/dist"
  arns_colas                  = module.mensajeria.arns_colas
  urls_colas                  = module.mensajeria.urls_colas
  arn_tabla_perfil_publico    = module.datos.arn_tabla_perfil_publico
  nombre_tabla_perfil_publico = module.datos.nombre_tabla_perfil_publico
  arn_secreto_bd              = module.datos.arn_secreto_bd
  direccion_rds               = module.datos.direccion_rds
  arns_identidades_ses        = module.mensajeria.arns_identidades_ses
  correo_remitente            = var.correo_remitente
}

module "observabilidad" {
  source = "../../modules/observabilidad"

  etiquetas_comunes        = local.etiquetas
  arn_tema_alertas         = module.mensajeria.arn_tema_alertas
  sufijo_arn_alb           = module.computo.sufijo_arn_alb
  sufijo_arn_grupo_destino = module.computo.sufijo_arn_grupo_destino
  identificador_rds        = module.datos.identificador_rds
  nombres_colas            = module.mensajeria.nombres_colas
  nombres_colas_fallidos   = module.mensajeria.nombres_colas_fallidos
}

module "respaldo" {
  source = "../../modules/respaldo"

  etiquetas_comunes = local.etiquetas
  arn_clave_datos   = module.seguridad.arn_clave_datos
  arns_recursos     = [module.datos.arn_rds]
}
