package hcm.etiquetas_test

import data.hcm.etiquetas
import rego.v1

plan_con(etiquetas_todas) := {"resource_changes": [{
	"address": "aws_s3_bucket.x",
	"type": "aws_s3_bucket",
	"change": {"actions": ["create"], "after": {"tags_all": etiquetas_todas}},
}]}

test_con_todas_las_etiquetas_pasa if {
	count(etiquetas.deny) == 0 with input as plan_con({"Project": "hcm", "Env": "dev", "Owner": "angel"})
}

test_sin_owner_se_deniega if {
	count(etiquetas.deny) == 1 with input as plan_con({"Project": "hcm", "Env": "dev"})
}

test_sin_ninguna_se_deniega if {
	count(etiquetas.deny) == 1 with input as plan_con({})
}

test_project_distinto_se_deniega if {
	count(etiquetas.deny) == 1 with input as plan_con({"Project": "otro", "Env": "dev", "Owner": "angel"})
}

test_recurso_sin_etiquetas_soportadas_se_ignora if {
	count(etiquetas.deny) == 0 with input as {"resource_changes": [{
		"address": "aws_s3_bucket_versioning.x",
		"type": "aws_s3_bucket_versioning",
		"change": {"actions": ["create"], "after": {"bucket": "b"}},
	}]}
}
