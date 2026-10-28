#!/usr/bin/env bash
# Puerta de calidad local = la misma que corre CI antes de aceptar un PR o desplegar.
# Uso: pnpm verify        (requiere Postgres local y .env; ver LOCAL-hcm/README.md)
# El proyecto es JavaScript puro (documentación del proyecto §9): no hay `tsc`. Lo que hace de "type check":
#   ESLint (no-undef, imports) + zod en los bordes + test de contrato web↔API + drift de migraciones.
set -euo pipefail
cd "$(dirname "$0")/.."

paso() { printf '\n\033[1m── %s\033[0m\n' "$1"; }

paso "1/6 Dependencias congeladas (lockfile al día)"
pnpm install --frozen-lockfile

paso "2/6 Migraciones: el esquema de Drizzle coincide con las migraciones versionadas"
(cd apps/api && rm -rf /tmp/hcm-drift && cp -r migrations /tmp/hcm-drift && pnpm exec drizzle-kit generate >/dev/null \
  && diff -r migrations /tmp/hcm-drift >/dev/null) \
  || { echo "El esquema (src/db/schema.js) cambió sin migración nueva. Corre db:generate y escribe su .down.sql."; rm -rf apps/api/migrations && cp -r /tmp/hcm-drift apps/api/migrations; exit 1; }

paso "3/6 Lint (ESLint, 0 warnings)"
pnpm lint

paso "4/6 Tests (shared + api + web, incluye migraciones y contrato web↔API)"
pnpm -r test

paso "5/6 Build del frontend"
pnpm build

paso "6/6 Auditoría de dependencias de producción (alta/crítica bloquea)"
pnpm audit --prod --audit-level=high

printf '\n\033[32m✔ Todo en verde: se puede publicar.\033[0m\n'
