# historial-clinico-mascotas
Plataforma de registro de historial clínico y salud para mascotas: perfil, vacunas, eventos clínicos y ficha pública por QR.

> Proyecto académico — UPAO, Infraestructura como Código.

## INTEGRANTES:
- Caipo Trujillo, Sonia Fernanda
- Torres Ruiz, Angel Eduardo
- Zavaleta Rodriguez, Martin Alonso

## PROBLEMATICA
 
Las veterinarias de La Libertad y de diferentes partes del Perú aún trabajan con cartillas físicas de vacunación: y se pueden perder, mojar o se terminan quedando en la veterinaria anterior. Entonces cuando eso ocurre,  el historial desaparece y hay que reconstruirlo de memoria o revacunar por precaución a las mascotas. 

A esto se le suma las siguientes dificultades operativo:  

- Cada consulta empieza con 5 a 10 minutos de reconstrucción verbal del historial.
- Con unas 30 atenciones diarias por clínica, eso son cerca de **3 horas al día** sin valor clínico.
- Nadie sabe con certeza cuándo vence el próximo refuerzo, por lo que la protección de la mascota se interrumpe y la clínica pierde atención recurrente.

## PROPUESTA DE SOLUCIÓN:
 
Un registro digital único por mascota, accesible para su propietario y para el personal veterinario, con calendario de vacunas y recordatorios de vencimiento.

## Usuarios objetivo
 
| Perfil | Necesidad principal |
|---|---|
| Dueño de Mascota(s) | Consultar el historial y los próximos refuerzos desde un solo lugar |
| Personal veterinario | Acceder al historial en pocas acciones durante la atención |
| Albergues | Registro masivo, consulta agregada y transferencias de mascotas frecuentes |

## Cómo funciona

Cada mascota tiene un expediente con su historial de vacunas, chequeos, tratamientos y desparasitaciones, y
una placa con código QR que abre una ficha pública si se extravía (sin datos personales del dueño).

- **Dueño:** registra mascotas, carga eventos con fotos de cartillas y recetas, recibe recordatorios de vacunas
  y puede transferir la mascota a otra persona con un código de un solo uso.
- **Veterinario colegiado:** escanea el QR, accede al expediente durante 4 horas y registra directamente lo que
  atiende. Una corrección nunca edita un evento: crea uno nuevo que referencia al anterior.
- **Ficha pública:** se arma desde un modelo de lectura aparte para seguir respondiendo aunque la base principal falle.

La API (Fastify + PostgreSQL) y la web (React + Vite) comparten los esquemas de `packages/shared`. Todo lo que en
la nube será un servicio de AWS (almacenamiento, colas, correo, secretos) está detrás de un puerto, con un adaptador
local y uno de AWS; se elige con `PROVEEDOR=local|aws`.

## Levantarlo con Docker

No hace falta tener Node ni pnpm: todo corre en contenedores.

**Requisitos:** Docker con Compose v2 (`docker compose`, con espacio), `openssl` para generar los secretos
(en Windows, usar Git Bash o WSL) y los puertos **3000** (API), **5173** (web) y **5433** (Postgres) libres.

### 1. Crear el `.env` (una sola vez)

```bash
[ -f .env ] || printf 'JWT_SECRET=%s\nDOC_ENCRYPTION_KEY=%s\nDOC_HMAC_PEPPER=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -base64 32)" "$(openssl rand -hex 32)" > .env
```

`DOC_ENCRYPTION_KEY` debe ser base64 de exactamente 32 bytes, así que no la escribas a mano. Cambiarla deja
ilegibles los documentos ya guardados. El `.env` está en `.gitignore` y nunca se sube.

### 2. Levantar

```bash
docker compose up --build
```

Levanta, en orden: `db` (Postgres 17), `migrate` (migraciones), `seed` (3 dueños, 5 mascotas y 20 eventos de
ejemplo, y un token de prueba por dueño), `api` y `web`. Está listo cuando `docker compose ps` muestra `api`,
`db` y `web` en `Up` (`migrate` y `seed` terminan solos).

| Qué | Dónde |
|---|---|
| Web | <http://localhost:5173> |
| API | <http://localhost:3000> |
| Postgres | `localhost:5433`, usuario, contraseña y base `hcm` |
| Tokens de prueba | `docker compose logs seed` |
| Código de 6 dígitos del login | `docker compose logs -f api` (busca `codigo_verificacion`; en local no sale por correo) |

```bash
docker compose ps                  # estado de cada servicio
docker compose logs -f api         # logs de la API
docker compose up --build -d       # reconstruir tras cambiar código
docker compose down                # apagar conservando los datos
docker compose down -v             # apagar y BORRAR los datos
```

| Síntoma | Arreglo |
|---|---|
| `port is already allocated` | Otro programa usa 3000, 5173 o 5433; ciérralo o cambia el puerto en `docker-compose.yml`. |
| `The "JWT_SECRET" variable is not set` | Falta el `.env`; créalo como en el paso 1. |
| `DOC_ENCRYPTION_KEY debe ser base64 de 32 bytes` | Genérala con `openssl rand -base64 32`. |
| Cambié el código y no se nota | Falta `--build`. |

## Levantarlo sin Docker

Requisitos: Node 22.22 o superior (las pruebas de la web usan jsdom 30; las imágenes Docker de la API siguen en Node 20), pnpm 9.15.4 (`corepack enable`) y PostgreSQL 17 en local.

```bash
pnpm install
cp .env.example .env     # completa DATABASE_URL y las variables de JWT y cifrado
pnpm db:migrate
pnpm db:seed
pnpm dev                 # API en :3000 y web en :5173
```

## Comandos útiles

```bash
pnpm lint            # ESLint en los tres paquetes
pnpm -r test         # pruebas (desde la pieza C necesitan PostgreSQL y las variables del .env)
pnpm build           # build de producción
pnpm db:reset        # trunca las tablas y vuelve a sembrar (solo bases locales)
pnpm verify          # lockfile, lint, pruebas, build y auditoría de dependencias
```

## Estructura del repositorio

```
├── apps/
│   ├── api/src/        Fastify + Drizzle
│   │   ├── routes/       HTTP: una ruta por recurso, sin lógica de negocio
│   │   ├── use-cases/    lógica de negocio por dominio (accounts, pets, health, transfers, vets, reminders, public)
│   │   ├── ports/        contratos de todo lo que será un servicio de AWS
│   │   ├── adapters/     local/ y aws/ (S3, SQS, SES, DynamoDB, Secrets Manager)
│   │   ├── workers/      trabajo asíncrono (normalizador, recordatorios, proyector)
│   │   └── db/, domain/, crypto/, audit/, auth/, plugins/
│   └── web/src/        React + Vite + Tailwind
├── packages/shared/    esquemas zod: contrato único entre web y API
├── infra/              Terraform (módulos, entornos y políticas OPA; sin aplicar)
├── scripts/            verificación, respaldo y pruebas de mutación
└── docker-compose.yml  db + migrate + seed + api + web
```

## Desplegar a AWS

Terraform levanta la infraestructura: red, base de datos, ECS, CloudFront, colas y Lambdas. La aplicación la sube
el workflow `.github/workflows/deploy.yml`, que después del `terraform apply` carga los secretos, publica la imagen
de la API, corre las migraciones, actualiza las Lambdas y sube la web. Termina con una prueba de humo contra
CloudFront. Los scripts que usa están en `scripts/despliegue/`.

### Preparar la cuenta (una sola vez)

El bootstrap crea el bucket del estado de Terraform con su clave de cifrado, los presupuestos y los dos roles que
asume GitHub Actions. Se aplica desde una terminal con credenciales de la cuenta:

```bash
cd infra/envs/bootstrap
cp terraform.example.tfvars terraform.tfvars
terraform init
terraform apply
```

Con sus salidas se cargan las variables del repositorio en GitHub (Settings, Secrets and variables, Actions):
`AWS_ROLE_ARN`, `AWS_PLAN_ROLE_ARN`, `TF_STATE_BUCKET`, `AWS_TFSTATE_KMS_KEY`, `AWS_ACCOUNT_ID`, `AWS_REGION`,
`CORREO_ALERTAS` y `CORREO_REMITENTE`. También hace falta el environment `dev`, limitado a la rama `development`
y con aprobación obligatoria. El rol de despliegue solo confía en ese environment.

### Desplegar

Se despliega lo que esté en `development`:

```bash
git checkout development
git merge main
git push origin development
```

El run queda esperando la aprobación del environment `dev` en la pestaña Actions. Cuando termina, el resumen
muestra la URL de la web.

SES está en modo sandbox. Después de desplegar llegan dos correos: el enlace de verificación del remitente y la
confirmación de la suscripción a las alertas. Hay que abrir los dos; sin el primero, SES no envía los códigos de
inicio de sesión.

### Apagar

Entre sesiones de laboratorio el entorno se destruye para no gastar créditos. El bootstrap se queda, porque guarda
el estado. `backend.hcl` se completa con los datos del bootstrap y Terraform pide `owner`, `correos_alerta` y
`correo_remitente`, los mismos valores que usa el workflow:

```bash
cd infra/envs/dev
cp backend.example.hcl backend.hcl
terraform init -backend-config=backend.hcl
terraform destroy
```

## Documentación

- [Proyecto a Desarrollar](docs/proyecto-a-desarrollar-historia-clinica-mascotas.pdf): el documento rector del sistema, con sus 18 requisitos no funcionales (RNF 01-18), la tabla de SLA y el diagrama de arquitectura. Los `Refs: RNF xx` de los commits remiten a su numeración.

## Avance del código

El código se sube por piezas, cada una en su Pull Request. Hasta ahora:

- **Base del monorepo** (pnpm workspace, ESLint, scripts de verificación). `pnpm install && pnpm lint`.
- **Contrato compartido** (`packages/shared`): esquemas zod y código público con dígito verificador.
- **Base de datos** (`apps/api`): esquema Drizzle, migraciones con reversión, cifrado de columna, auditoría y tokens.
- **Puertos y adaptadores locales** (`apps/api/src/ports`, `adapters/local`): todo servicio externo detrás de una interfaz.
- **Cuentas y login**: dueños y veterinarios, inicio de sesión con código de 6 dígitos por correo.
- **Adaptadores AWS** (`adapters/aws`): S3, SQS, SES, DynamoDB y Secrets Manager, activos con `PROVEEDOR=aws`.
- **Terraform base** (`infra/`): bootstrap, presupuesto, OIDC de GitHub, red y seguridad.
- **Mascotas y ficha pública**: alta de mascota, camadas y consulta pública por QR sin datos personales.
- **Historial clínico**: eventos de salud, registro directo del veterinario y evidencias adjuntas.
- **Transferencias y recordatorios**: transferencia atómica, recordatorios de vacunas, workers y la app HTTP completa.
- **Web** (`apps/web`): aplicación React con panel del dueño, del veterinario y ficha pública.
- **Docker**: imágenes de la API y la web y `docker-compose.yml` para levantar todo en local.
- **Terraform de datos y cómputo**: bases, colas, identidad, cómputo, borde, Lambdas, observabilidad y respaldo; políticas OPA.
- **Despliegue a AWS**: workflow que aplica Terraform y publica la aplicación (secretos, imagen, migraciones, Lambdas y web).
