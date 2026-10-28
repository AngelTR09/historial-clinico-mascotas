#!/usr/bin/env bash
# Construye y sube la imagen de la API a ECR con la etiqueta dada. Las etiquetas del repositorio son
# inmutables: si la etiqueta ya existe no se vuelve a subir. La última línea de stdout es la referencia
# completa de la imagen; todo lo demás va a stderr.
set -euo pipefail

region="${AWS_REGION:?Falta AWS_REGION}"
repositorio="${REPOSITORIO_ECR:?Falta REPOSITORIO_ECR (por ejemplo 123456789012.dkr.ecr.us-east-2.amazonaws.com/hcm-api)}"
etiqueta="${ETIQUETA:?Falta ETIQUETA}"
registro="${repositorio%%/*}"
nombre="${repositorio#*/}"

if aws ecr describe-images --region "$region" --repository-name "$nombre" --image-ids "imageTag=$etiqueta" > /dev/null 2>&1; then
  echo "la imagen $etiqueta ya existe en ECR: no se vuelve a subir" >&2
else
  aws ecr get-login-password --region "$region" | docker login --username AWS --password-stdin "$registro" >&2
  docker build -f apps/api/Dockerfile -t "$repositorio:$etiqueta" . >&2
  docker push "$repositorio:$etiqueta" >&2
fi
echo "$repositorio:$etiqueta"
