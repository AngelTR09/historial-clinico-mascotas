# Reglas mínimas de seguridad sobre el plan: cifrado, buckets privados y puertos.
package hcm.seguridad

import rego.v1

crea(rc) if "create" in rc.change.actions

deny contains msg if {
	some rc in input.resource_changes
	crea(rc)
	rc.type == "aws_db_instance"
	not rc.change.after.storage_encrypted == true
	msg := sprintf("%s: la base de datos debe tener storage_encrypted = true (RNF 13)", [rc.address])
}

bloqueos := ["block_public_acls", "block_public_policy", "ignore_public_acls", "restrict_public_buckets"]

deny contains msg if {
	some rc in input.resource_changes
	crea(rc)
	rc.type == "aws_s3_bucket_public_access_block"
	some bloqueo in bloqueos
	not rc.change.after[bloqueo] == true
	msg := sprintf("%s: %s debe ser true, ningún bucket puede quedar público", [rc.address, bloqueo])
}

deny contains msg if {
	some rc in input.resource_changes
	crea(rc)
	rc.type == "aws_security_group"
	some regla in rc.change.after.ingress
	"0.0.0.0/0" in regla.cidr_blocks
	regla.from_port <= 22
	regla.to_port >= 22
	msg := sprintf("%s abre SSH (22) a todo internet", [rc.address])
}

deny contains msg if {
	some rc in input.resource_changes
	crea(rc)
	rc.type == "aws_iam_role_policy_attachment"
	endswith(rc.change.after.policy_arn, "/AdministratorAccess")
	not endswith(rc.address, "github_oidc.aws_iam_role_policy_attachment.apply")
	msg := sprintf("%s adjunta AdministratorAccess: solo se permite en el rol de apply de OIDC", [rc.address])
}

# En prod ningún recurso con datos puede borrarse con contenido: force_destroy/force_delete es solo de dev.
borrado_forzado := {
	"aws_s3_bucket": "force_destroy",
	"aws_ecr_repository": "force_delete",
	"aws_backup_vault": "force_destroy",
}

deny contains msg if {
	some rc in input.resource_changes
	crea(rc)
	atributo := borrado_forzado[rc.type]
	rc.change.after[atributo] == true
	rc.change.after.tags_all.Env == "prod"
	msg := sprintf("%s tiene %s = true en prod: el borrado con contenido solo se permite en dev", [rc.address, atributo])
}
