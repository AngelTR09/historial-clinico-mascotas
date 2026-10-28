#!/usr/bin/env bash
# Aplica las migraciones (y el seed idempotente) con una tarea efímera de ECS: la base está en una red privada
# y no se puede alcanzar desde fuera. Reutiliza la definición de tarea y la red del servicio, cambia el comando,
# espera a que termine y falla si el código de salida no es 0.
set -euo pipefail

region="${AWS_REGION:?Falta AWS_REGION}"
cluster="${CLUSTER:?Falta CLUSTER}"
servicio="${SERVICIO:?Falta SERVICIO}"
definicion="${1:?Uso: migrar-bd.sh <arn de la definición de tarea>}"
comando="${COMANDO_MIGRACION:-node src/db/migrate.js && node src/db/seed.js}"
contenedor="${CONTENEDOR_API:-api}"

red=$(aws ecs describe-services --region "$region" --cluster "$cluster" --services "$servicio" \
  --query 'services[0].networkConfiguration.awsvpcConfiguration' --output json)
subredes=$(jq -r '.subnets | join(",")' <<< "$red")
grupos=$(jq -r '.securityGroups | join(",")' <<< "$red")
sobrescritura=$(jq -cn --arg c "$contenedor" --arg cmd "$comando" '{containerOverrides: [{name: $c, command: ["sh", "-c", $cmd]}]}')

tarea=$(aws ecs run-task --region "$region" --cluster "$cluster" --launch-type FARGATE \
  --task-definition "$definicion" --started-by "despliegue-${GITHUB_RUN_ID:-local}" \
  --network-configuration "awsvpcConfiguration={subnets=[$subredes],securityGroups=[$grupos],assignPublicIp=ENABLED}" \
  --overrides "$sobrescritura" --query 'tasks[0].taskArn' --output text)
if [[ -z "$tarea" || "$tarea" == "None" ]]; then
  echo "ECS no pudo iniciar la tarea de migración" >&2
  exit 1
fi
echo "tarea de migración: $tarea"

aws ecs wait tasks-stopped --region "$region" --cluster "$cluster" --tasks "$tarea"
codigo=$(aws ecs describe-tasks --region "$region" --cluster "$cluster" --tasks "$tarea" \
  --query 'tasks[0].containers[0].exitCode' --output text)
if [[ "$codigo" != "0" ]]; then
  echo "la migración terminó con código $codigo; últimas líneas del log:" >&2
  aws logs tail "${GRUPO_LOGS:-/ecs/$servicio}" --region "$region" --since 15m --format short 2>&1 | tail -40 >&2 || true
  exit 1
fi
echo "migraciones aplicadas (código 0)"
