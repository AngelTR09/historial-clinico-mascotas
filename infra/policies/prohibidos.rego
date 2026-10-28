# Servicios prohibidos sin discusión previa (documentación del proyecto §11, ADR 0005).
package hcm.prohibidos

import rego.v1

tipos_prohibidos := {
	"aws_nat_gateway": "NAT Gateway cuesta ~USD 33/mes solo por existir: usar VPC endpoints o subredes públicas",
	"aws_eks_cluster": "EKS cuesta USD 73/mes solo el control plane: ECS Fargate cubre el caso",
	"aws_elasticache_cluster": "ElastiCache no está justificado por ningún RNF: el caché lo resuelve CloudFront",
	"aws_elasticache_replication_group": "ElastiCache no está justificado por ningún RNF: el caché lo resuelve CloudFront",
	"aws_opensearch_domain": "OpenSearch gestionado: la búsqueda no es requisito del proyecto",
	"aws_elasticsearch_domain": "OpenSearch gestionado: la búsqueda no es requisito del proyecto",
	"aws_rds_cluster": "Aurora no está justificado: RDS PostgreSQL normal cubre el volumen",
}

crea(rc) if "create" in rc.change.actions

deny contains msg if {
	some rc in input.resource_changes
	crea(rc)
	razon := tipos_prohibidos[rc.type]
	msg := sprintf("%s (%s) está prohibido: %s", [rc.address, rc.type, razon])
}

# Multi-AZ y las Elastic IP no se prohíben, pero se avisan: el costo corre mientras existan.
warn contains msg if {
	some rc in input.resource_changes
	crea(rc)
	rc.type == "aws_db_instance"
	rc.change.after.multi_az == true
	msg := sprintf("%s tiene Multi-AZ: encender solo en exposición y pruebas, y apagarlo al terminar (documentación del proyecto §11)", [rc.address])
}

warn contains msg if {
	some rc in input.resource_changes
	crea(rc)
	rc.type == "aws_eip"
	msg := sprintf("%s es una Elastic IP: si queda sin asociar cuesta dinero", [rc.address])
}
