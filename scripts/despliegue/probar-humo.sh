#!/usr/bin/env bash
# Prueba de humo del despliegue: la API responde sana por CloudFront y la web se sirve.
# Reintenta porque el balanceador tarda un poco en dar la tarea por sana.
set -euo pipefail

dominio="${1:?Uso: probar-humo.sh <dominio de CloudFront>}"
intentos="${INTENTOS:-20}"
pausa="${PAUSA:-15}"

for ((i = 1; i <= intentos; i++)); do
  respuesta=$(curl -fsS --max-time 10 "https://$dominio/api/health" 2> /dev/null || true)
  if [[ "$respuesta" == *'"status":"ok"'* ]]; then
    echo "la API responde sana (intento $i)"
    break
  fi
  if ((i == intentos)); then
    echo "la API no respondió sana tras $intentos intentos" >&2
    exit 1
  fi
  sleep "$pausa"
done

codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$dominio/")
if [[ "$codigo" != "200" ]]; then
  echo "la web respondió $codigo en lugar de 200" >&2
  exit 1
fi
echo "la web se sirve (200)"
