# Etiquetas obligatorias Project, Env y Owner en todo recurso que las admita (documentación del proyecto §11).
package hcm.etiquetas

import rego.v1

obligatorias := {"Project", "Env", "Owner"}

crea(rc) if "create" in rc.change.actions

crea(rc) if "update" in rc.change.actions

# Solo los recursos que admiten etiquetas tienen `tags_all` en el plan.
etiquetable(rc) if is_object(rc.change.after.tags_all)

faltantes(rc) := obligatorias - {clave | some clave, _ in rc.change.after.tags_all}

deny contains msg if {
	some rc in input.resource_changes
	crea(rc)
	etiquetable(rc)
	faltan := faltantes(rc)
	count(faltan) > 0
	msg := sprintf("%s no tiene las etiquetas obligatorias: %s", [rc.address, concat(", ", sort(faltan))])
}

deny contains msg if {
	some rc in input.resource_changes
	crea(rc)
	etiquetable(rc)
	rc.change.after.tags_all.Project != "hcm"
	msg := sprintf("%s tiene Project=%v y debe ser hcm", [rc.address, rc.change.after.tags_all.Project])
}
