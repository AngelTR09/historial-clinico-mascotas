# Contexto de build: la raíz del monorepo (necesario para resolver el
# workspace de pnpm y el paquete @hcm/shared).
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/web apps/web

# Vite incrusta VITE_* en el bundle en tiempo de build, no de arranque:
# el navegador corre fuera de la red de Docker, así que debe apuntar a un
# puerto publicado en el host (el mismo con el que se mapea el servicio api).
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/apps/web
RUN pnpm build

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
