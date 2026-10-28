package hcm.seguridad_test

import data.hcm.seguridad
import rego.v1

plan_con(tipo, direccion, despues) := {"resource_changes": [{
	"address": direccion,
	"type": tipo,
	"change": {"actions": ["create"], "after": despues},
}]}

test_rds_sin_cifrado_se_deniega if {
	count(seguridad.deny) == 1 with input as plan_con("aws_db_instance", "aws_db_instance.x", {"storage_encrypted": false})
}

test_rds_cifrada_pasa if {
	count(seguridad.deny) == 0 with input as plan_con("aws_db_instance", "aws_db_instance.x", {"storage_encrypted": true})
}

test_bucket_publico_se_deniega if {
	count(seguridad.deny) == 1 with input as plan_con("aws_s3_bucket_public_access_block", "aws_s3_bucket_public_access_block.x", {
		"block_public_acls": true,
		"block_public_policy": false,
		"ignore_public_acls": true,
		"restrict_public_buckets": true,
	})
}

test_bucket_privado_pasa if {
	count(seguridad.deny) == 0 with input as plan_con("aws_s3_bucket_public_access_block", "aws_s3_bucket_public_access_block.x", {
		"block_public_acls": true,
		"block_public_policy": true,
		"ignore_public_acls": true,
		"restrict_public_buckets": true,
	})
}

test_ssh_abierto_se_deniega if {
	count(seguridad.deny) == 1 with input as plan_con("aws_security_group", "aws_security_group.x", {"ingress": [{
		"cidr_blocks": ["0.0.0.0/0"],
		"from_port": 22,
		"to_port": 22,
	}]})
}

test_https_abierto_pasa if {
	count(seguridad.deny) == 0 with input as plan_con("aws_security_group", "aws_security_group.x", {"ingress": [{
		"cidr_blocks": ["0.0.0.0/0"],
		"from_port": 443,
		"to_port": 443,
	}]})
}

test_admin_fuera_de_oidc_se_deniega if {
	count(seguridad.deny) == 1 with input as plan_con("aws_iam_role_policy_attachment", "aws_iam_role_policy_attachment.x", {"policy_arn": "arn:aws:iam::aws:policy/AdministratorAccess"})
}

test_admin_en_rol_apply_pasa if {
	count(seguridad.deny) == 0 with input as plan_con("aws_iam_role_policy_attachment", "module.github_oidc.aws_iam_role_policy_attachment.apply", {"policy_arn": "arn:aws:iam::aws:policy/AdministratorAccess"})
}

test_borrado_forzado_en_prod_se_deniega if {
	count(seguridad.deny) == 1 with input as plan_con("aws_s3_bucket", "aws_s3_bucket.x", {"force_destroy": true, "tags_all": {"Env": "prod"}})
}

test_borrado_forzado_en_dev_pasa if {
	count(seguridad.deny) == 0 with input as plan_con("aws_s3_bucket", "aws_s3_bucket.x", {"force_destroy": true, "tags_all": {"Env": "dev"}})
}

test_ecr_con_borrado_forzado_en_prod_se_deniega if {
	count(seguridad.deny) == 1 with input as plan_con("aws_ecr_repository", "aws_ecr_repository.x", {"force_delete": true, "tags_all": {"Env": "prod"}})
}

test_respaldo_de_un_dia_en_prod_se_deniega if {
	count(seguridad.deny) == 1 with input as plan_con("aws_db_instance", "aws_db_instance.x", {"storage_encrypted": true, "backup_retention_period": 1, "tags_all": {"Env": "prod"}})
}

test_respaldo_de_un_dia_en_dev_pasa if {
	count(seguridad.deny) == 0 with input as plan_con("aws_db_instance", "aws_db_instance.x", {"storage_encrypted": true, "backup_retention_period": 1, "tags_all": {"Env": "dev"}})
}

test_respaldo_de_siete_dias_en_prod_pasa if {
	count(seguridad.deny) == 0 with input as plan_con("aws_db_instance", "aws_db_instance.x", {"storage_encrypted": true, "backup_retention_period": 7, "tags_all": {"Env": "prod"}})
}
