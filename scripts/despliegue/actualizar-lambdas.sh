#!/usr/bin/env bash
# Sube el código nuevo de las cuatro Lambdas. En Terraform las funciones ignoran los cambios de su paquete
# (filename y source_code_hash): crearlas es cosa de `terraform apply`, actualizarlas es de este paso.
set -euo pipefail

region="${AWS_REGION:?Falta AWS_REGION}"
prefijo="${PREFIJO_FUNCIONES:-hcm}"
directorio="${DIRECTORIO_PAQUETES:-workers/dist}"

for f in proyector normalizador recordatorios notificador; do
  aws lambda update-function-code --region "$region" --function-name "$prefijo-$f" \
    --zip-file "fileb://$directorio/$f.zip" --query LastModified --output text > /dev/null
  aws lambda wait function-updated --region "$region" --function-name "$prefijo-$f"
  echo "código actualizado: $prefijo-$f"
done
