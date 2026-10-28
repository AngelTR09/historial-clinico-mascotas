# Contexto de build: la raíz del monorepo (necesario para resolver el
# workspace de pnpm). Esta misma imagen sirve hoy para docker-compose local
# y mañana para ECS Fargate: lo que cambia es el orquestador, no el Dockerfile
# (documentación del proyecto sección 13).
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copiamos primero solo los manifiestos de cada paquete del workspace para
# que `pnpm install` quede cacheado mientras no cambien las dependencias.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
EXPOSE 3000

# Sin --watch: en un contenedor no hay edición de archivos en vivo. Las
# migraciones y el seed corren como comandos separados (ver docker-compose.yml),
# nunca dentro del arranque del servidor.
CMD ["node", "src/server.js"]
