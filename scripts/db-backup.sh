#!/usr/bin/env bash
# Respaldo lógico de la base ANTES de migrar o revertir. Uso: pnpm db:backup [carpeta]
# Lee DATABASE_URL del .env de la raíz. Los respaldos quedan en backups/ (ignorada por git).
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$raiz/.env" ] && set -a && . "$raiz/.env" && set +a
: "${DATABASE_URL:?Falta DATABASE_URL (copia .env.example a .env)}"
destino="${1:-$raiz/backups}"
mkdir -p "$destino"
archivo="$destino/hcm-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --file="$archivo" "$DATABASE_URL"
echo "Respaldo escrito en $archivo"
echo "Restaurar: pg_restore --clean --if-exists --no-owner -d \"\$DATABASE_URL\" $archivo"
