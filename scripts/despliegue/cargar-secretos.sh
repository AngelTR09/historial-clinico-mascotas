#!/usr/bin/env bash
# Carga el valor de los tres secretos de la API SOLO si no tienen ninguno. Nunca rota uno que ya existe:
# cambiar DOC_ENCRYPTION_KEY dejaría ilegibles los datos cifrados con la anterior.
# Los valores se generan al vuelo y no se imprimen; solo se informa qué secretos se cargaron.
set -euo pipefail

region="${AWS_REGION:?Falta AWS_REGION}"
prefijo="${PREFIJO_SECRETOS:-hcm}"

generar() {
  case "$1" in
    doc-encryption-key) openssl rand -base64 32 ;; # AES-256: base64 de exactamente 32 bytes
    *) openssl rand -hex 32 ;;
  esac
}

for nombre in doc-encryption-key doc-hmac-pepper firma-acceso-vet; do
  id="$prefijo/$nombre"
  etapas=$(aws secretsmanager describe-secret --region "$region" --secret-id "$id" --query 'VersionIdsToStages' --output text)
  if [[ "$etapas" == *AWSCURRENT* ]]; then
    echo "ya tiene valor: $id"
    continue
  fi
  aws secretsmanager put-secret-value --region "$region" --secret-id "$id" \
    --secret-string "$(generar "$nombre")" --query VersionId --output text > /dev/null
  echo "valor cargado: $id"
done
