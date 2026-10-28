mock_provider "aws" {}

run "dos_zonas_sin_nat_y_db_cerrada" {
  command = plan

  assert {
    condition     = length(aws_subnet.publica) == 2 && length(aws_subnet.privada) == 2
    error_message = "Debe haber una subred pública y una privada por cada una de las dos zonas."
  }

  assert {
    condition     = aws_vpc_endpoint.s3.vpc_endpoint_type == "Gateway" && aws_vpc_endpoint.dynamodb.vpc_endpoint_type == "Gateway"
    error_message = "S3 y DynamoDB deben usar endpoints gateway (gratis), no NAT."
  }

  assert {
    condition     = aws_subnet.publica[0].map_public_ip_on_launch == false
    error_message = "Las subredes no asignan IP pública por defecto; lo decide cada servicio."
  }
}

run "endpoints_de_interfaz_con_dns_privado_y_alcanzables_desde_las_lambdas" {
  command = plan

  assert {
    condition     = contains(keys(aws_vpc_endpoint.interfaz), "sqs") && contains(keys(aws_vpc_endpoint.interfaz), "secretsmanager")
    error_message = "Las Lambdas en la VPC necesitan SQS (encolar recordatorios) y Secrets Manager (contraseña de RDS)."
  }

  assert {
    condition     = alltrue([for e in aws_vpc_endpoint.interfaz : e.private_dns_enabled])
    error_message = "Sin DNS privado la Lambda resuelve la dirección pública y no llega al endpoint."
  }

  assert {
    condition     = aws_vpc_security_group_ingress_rule.endpoints_desde_funciones.from_port == 443 && aws_vpc_security_group_egress_rule.funciones_hacia_endpoints.to_port == 443
    error_message = "El endpoint debe aceptar 443 desde las Lambdas y estas deben poder salir por 443 hacia él."
  }
}

run "rechaza_una_sola_zona" {
  command = plan

  variables {
    zonas = ["us-east-1a"]
  }

  expect_failures = [var.zonas]
}

run "las_zonas_por_defecto_siguen_a_la_region" {
  command = plan

  override_data {
    target = data.aws_region.actual
    values = {
      name = "us-east-2"
    }
  }

  assert {
    condition     = [for s in aws_subnet.publica : s.availability_zone] == ["us-east-2a", "us-east-2b"]
    error_message = "Sin zonas explícitas se usan <región>a y <región>b: nunca zonas de otra región."
  }
}
