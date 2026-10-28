# VPC de dos zonas SIN NAT Gateway (documentación del proyecto §11). Subredes públicas para el ALB y las
# tareas Fargate (con IP pública), subredes privadas para RDS y las Lambdas que leen la
# base. Los endpoints gateway de S3 y DynamoDB son gratis.

data "aws_region" "actual" {}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

locals {
  cidr_publicas = [for i, _ in var.zonas : cidrsubnet(var.cidr_vpc, 8, i)]
  cidr_privadas = [for i, _ in var.zonas : cidrsubnet(var.cidr_vpc, 8, i + 10)]
}

# aws-ec2-require-vpc-flow-logs-for-all-vpcs: Flow logs diferidos: no los exige ningún RNF del PDF y suman costo de ingesta (documentación del proyecto §18).
#tfsec:ignore:aws-ec2-require-vpc-flow-logs-for-all-vpcs
resource "aws_vpc" "principal" {
  cidr_block           = var.cidr_vpc
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-vpc" })
}

# La SG por defecto se deja sin reglas: nada la usa por accidente.
resource "aws_default_security_group" "predeterminado" {
  vpc_id = aws_vpc.principal.id

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-sg-por-defecto-sin-reglas" })
}

resource "aws_internet_gateway" "principal" {
  vpc_id = aws_vpc.principal.id

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-igw" })
}

resource "aws_subnet" "publica" {
  count = length(var.zonas)

  vpc_id                  = aws_vpc.principal.id
  availability_zone       = var.zonas[count.index]
  cidr_block              = local.cidr_publicas[count.index]
  map_public_ip_on_launch = false

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-publica-${count.index}" })
}

resource "aws_subnet" "privada" {
  count = length(var.zonas)

  vpc_id            = aws_vpc.principal.id
  availability_zone = var.zonas[count.index]
  cidr_block        = local.cidr_privadas[count.index]

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-privada-${count.index}" })
}

resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.principal.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.principal.id
  }

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-rt-publica" })
}

resource "aws_route_table" "privada" {
  vpc_id = aws_vpc.principal.id

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-rt-privada" })
}

resource "aws_route_table_association" "publica" {
  count = length(var.zonas)

  subnet_id      = aws_subnet.publica[count.index].id
  route_table_id = aws_route_table.publica.id
}

resource "aws_route_table_association" "privada" {
  count = length(var.zonas)

  subnet_id      = aws_subnet.privada[count.index].id
  route_table_id = aws_route_table.privada.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.principal.id
  service_name      = "com.amazonaws.${data.aws_region.actual.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.publica.id, aws_route_table.privada.id]

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-vpce-s3" })
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.principal.id
  service_name      = "com.amazonaws.${data.aws_region.actual.name}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.publica.id, aws_route_table.privada.id]

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-vpce-dynamodb" })
}

resource "aws_vpc_endpoint" "interfaz" {
  for_each = var.endpoints_interfaz

  vpc_id              = aws_vpc.principal.id
  service_name        = "com.amazonaws.${data.aws_region.actual.name}.${each.key}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.privada[*].id
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-vpce-${each.key}" })
}

# ---------- Grupos de seguridad ----------
# Cadena: CloudFront -> ALB -> API -> RDS. Las Lambdas llegan a RDS y a los endpoints.

resource "aws_security_group" "alb" {
  name        = "${var.nombre_proyecto}-alb"
  description = "ALB: solo recibe trafico de CloudFront"
  vpc_id      = aws_vpc.principal.id

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-sg-alb" })
}

resource "aws_security_group" "api" {
  name        = "${var.nombre_proyecto}-api"
  description = "Tareas Fargate de la API"
  vpc_id      = aws_vpc.principal.id

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-sg-api" })
}

resource "aws_security_group" "db" {
  name        = "${var.nombre_proyecto}-db"
  description = "RDS PostgreSQL: solo la API y las Lambdas"
  vpc_id      = aws_vpc.principal.id

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-sg-db" })
}

resource "aws_security_group" "funciones" {
  name        = "${var.nombre_proyecto}-funciones"
  description = "Lambdas dentro de la VPC"
  vpc_id      = aws_vpc.principal.id

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-sg-funciones" })
}

resource "aws_security_group" "endpoints" {
  name        = "${var.nombre_proyecto}-endpoints"
  description = "Endpoints de interfaz de la VPC"
  vpc_id      = aws_vpc.principal.id

  tags = merge(var.etiquetas_comunes, { Name = "${var.nombre_proyecto}-sg-endpoints" })
}

resource "aws_vpc_security_group_ingress_rule" "alb_desde_cloudfront" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP desde los origenes de CloudFront (TLS termina en CloudFront)"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
}

resource "aws_vpc_security_group_egress_rule" "alb_hacia_api" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Hacia las tareas de la API"
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
  referenced_security_group_id = aws_security_group.api.id
}

resource "aws_vpc_security_group_ingress_rule" "api_desde_alb" {
  security_group_id            = aws_security_group.api.id
  description                  = "Trafico del ALB"
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "api_https" {
  security_group_id = aws_security_group.api.id
  description       = "APIs de AWS (S3, DynamoDB, SQS, ECR, Secrets Manager) por internet: sin NAT"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "api_hacia_db" {
  security_group_id            = aws_security_group.api.id
  description                  = "PostgreSQL"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.db.id
}

resource "aws_vpc_security_group_ingress_rule" "db_desde_api" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL desde la API"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.api.id
}

resource "aws_vpc_security_group_ingress_rule" "db_desde_funciones" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL desde las Lambdas"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.funciones.id
}

resource "aws_vpc_security_group_egress_rule" "funciones_hacia_db" {
  security_group_id            = aws_security_group.funciones.id
  description                  = "PostgreSQL"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.db.id
}

resource "aws_vpc_security_group_egress_rule" "funciones_hacia_endpoints" {
  security_group_id            = aws_security_group.funciones.id
  description                  = "Endpoints de interfaz"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.endpoints.id
}

resource "aws_vpc_security_group_egress_rule" "funciones_hacia_s3" {
  security_group_id = aws_security_group.funciones.id
  description       = "Endpoint gateway de S3"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  prefix_list_id    = aws_vpc_endpoint.s3.prefix_list_id
}

resource "aws_vpc_security_group_egress_rule" "funciones_hacia_dynamodb" {
  security_group_id = aws_security_group.funciones.id
  description       = "Endpoint gateway de DynamoDB"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  prefix_list_id    = aws_vpc_endpoint.dynamodb.prefix_list_id
}

resource "aws_vpc_security_group_ingress_rule" "endpoints_desde_funciones" {
  security_group_id            = aws_security_group.endpoints.id
  description                  = "HTTPS desde las Lambdas"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.funciones.id
}
