package hcm.prohibidos_test

import data.hcm.prohibidos
import rego.v1

plan_con(tipo, despues) := {"resource_changes": [{
	"address": sprintf("%s.x", [tipo]),
	"type": tipo,
	"change": {"actions": ["create"], "after": despues},
}]}

test_nat_gateway_se_deniega if {
	count(prohibidos.deny) == 1 with input as plan_con("aws_nat_gateway", {})
}

test_aurora_se_deniega if {
	count(prohibidos.deny) == 1 with input as plan_con("aws_rds_cluster", {})
}

test_bucket_no_se_deniega if {
	count(prohibidos.deny) == 0 with input as plan_con("aws_s3_bucket", {})
}

test_nat_existente_sin_cambios_no_se_deniega if {
	count(prohibidos.deny) == 0 with input as {"resource_changes": [{
		"address": "aws_nat_gateway.x",
		"type": "aws_nat_gateway",
		"change": {"actions": ["no-op"], "after": {}},
	}]}
}

test_multi_az_avisa if {
	count(prohibidos.warn) == 1 with input as plan_con("aws_db_instance", {"multi_az": true})
}

test_single_az_no_avisa if {
	count(prohibidos.warn) == 0 with input as plan_con("aws_db_instance", {"multi_az": false})
}
