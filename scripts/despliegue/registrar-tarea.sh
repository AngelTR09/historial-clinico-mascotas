#!/usr/bin/env bash
# Registra una revisión nueva de la definición de tarea de la API con la imagen dada y escribe su ARN en
# stdout. El servicio de ECS ignora los cambios de su definición en Terraform: quien despliega la imagen es
# este paso, no `terraform apply`.
set -euo pipefail

region="${AWS_REGION:?Falta AWS_REGION}"
familia="${FAMILIA_TAREA:-hcm-api}"
contenedor="${CONTENEDOR_API:-api}"
imagen="${1:?Uso: registrar-tarea.sh <imagen>}"
aqui="$(cd "$(dirname "$0")" && pwd)"

actual=$(aws ecs describe-task-definition --region "$region" --task-definition "$familia" --query taskDefinition --output json)
nueva=$(jq --arg imagen "$imagen" --arg contenedor "$contenedor" -f "$aqui/nueva-tarea.jq" <<< "$actual")
aws ecs register-task-definition --region "$region" --cli-input-json "$nueva" \
  --query taskDefinition.taskDefinitionArn --output text
