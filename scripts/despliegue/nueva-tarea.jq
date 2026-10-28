# Convierte la descripción de una definición de tarea (aws ecs describe-task-definition) en la entrada de
# register-task-definition con otra imagen. Solo pasan los campos que acepta esa llamada (la lista sale de
# `aws ecs register-task-definition --generate-cli-skeleton`): la descripción trae además el ARN, la revisión,
# el estado y la fecha de registro, que la API rechaza.
. as $d
| ($d | {family, taskRoleArn, executionRoleArn, networkMode, volumes, placementConstraints,
          requiresCompatibilities, cpu, memory, runtimePlatform, ephemeralStorage, pidMode, ipcMode,
          enableFaultInjection})
| with_entries(select(.value != null))
| .containerDefinitions = ($d.containerDefinitions
    | map(if .name == $contenedor then .image = $imagen else . end))
