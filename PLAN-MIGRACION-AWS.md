# Plan de ejecución: migración de Historial Clínico Mascotas de local a AWS

> **Estado: plan, sin ejecutar.** Hoy el proyecto vive 100 % en local (documentación del proyecto §13). Mientras este plan no se
> ejecute siguen prohibidos `@aws-sdk/*` en el código, `terraform apply` contra una cuenta real y cualquier
> servicio gestionado. Este documento ordena *cómo* se levanta la fase AWS cuando llegue el momento.
> Las cifras de costo son estimaciones de orden de magnitud: se validan con Infracost en cada PR (§11 de documentación del proyecto).

## 0. Reglas que no cambian

| Regla | Consecuencia práctica |
|---|---|
| Presupuesto duro **USD 200**, objetivo **USD 35/mes** | Infra efímera: `terraform destroy` al terminar cada sesión. Presupuesto y alertas ANTES que cualquier recurso. |
| Un solo desarrollador | Un módulo de Terraform por dominio, nada hecho a mano en la consola. Si un servicio no está justificado por un RNF del informe, no entra. |
| Prohibido sin discusión: NAT Gateway, EKS, ElastiCache, OpenSearch, Aurora, Multi-AZ permanente, EIP/EBS huérfanos | Subredes públicas + VPC endpoints (gateway: S3, DynamoDB) en lugar de NAT. |
| Cambios de `AWS-hcm/infra/` siempre en su propia rama | El `terraform plan` del PR debe ser legible. Máx. 3 commits por rama. |
| Los puertos no se tocan | Se **agrega** `apps/api/src/adapters/aws/` y se cambia la selección en `src/container.js`. Los casos de uso no se enteran. |
| Etiquetas `Project=hcm`, `Env`, `Owner` en todo | Variable `etiquetas_comunes` en cada módulo + política OPA que falla el PR si falta. |

## 1. Antes de escribir una línea de Terraform (bloqueantes)

Son decisiones y deudas que, si se arrastran a la nube, se pagan el doble. Ninguna es técnicamente difícil; varias son **decisiones de Angel**.

- [ ] **RN 3 (documentación del proyecto §17.10):** el código sigue en el modelo "dueño declara → veterinario valida". Decidir si `validations`/`confidence_level` se eliminan, se reinterpretan o conviven, y migrar *antes* de proyectar a DynamoDB: la proyección pública incluye "nivel de confianza" y no conviene cambiarla después.
- [ ] **RNF20 (§17.12):** ¿100 registros concurrentes ≤ 3 s es lo mismo que la carga masiva de albergue (<60 s, por cola)? Sin decisión explícita no se dimensiona la concurrencia del servicio ni de Lambda.
- [ ] Reconciliar la numeración RF/RNF con `docs/informe/informe-requisitos.md` (§17.9); cada commit de infra cita `Refs:` con la numeración definitiva.
- [ ] `pnpm verify` en verde en `main` (lint + tests + build + drift de migraciones + auditoría). Es la línea base contra la que se compara todo.
- [ ] Actualizar las dependencias de desarrollo con avisos (vitest 3 → 4) para que `pnpm audit` completo quede limpio antes de automatizar el despliegue.
- [ ] Una cuenta AWS nueva (o una Organización con cuenta dedicada), MFA en root, **sin** access keys de larga vida: GitHub Actions entra por OIDC.

## 2. Fases

Cada fase = una o más ramas cortas. Cada fase tiene una **puerta de salida**: no se empieza la siguiente sin cumplirla.

### Fase 0 — Cimientos y control de costo  · rama `chore/terraform-backend`
Entregables
- `AWS-hcm/infra/modules/bootstrap`: bucket S3 de estado (versionado, cifrado KMS, bloqueo de acceso público) + tabla DynamoDB de lock. Se crea **una vez**, con estado local, y luego se migra al backend remoto.
- **AWS Budgets** al 50 / 75 / 90 % (SNS → correo) y alerta de anomalías de costo. Primer recurso del proyecto.
- Rol OIDC para GitHub Actions: un rol de solo `plan` (PR) y otro de `apply` (solo rama protegida / ejecución manual con aprobación).
- `AWS-hcm/infra/envs/dev` y `AWS-hcm/infra/envs/prod` que solo *llaman* módulos (nada de recursos sueltos).

Puerta de salida: `terraform init/plan` desde CI sin credenciales estáticas; la alerta de presupuesto llega de verdad (se prueba con un umbral bajo).
Reversión: `terraform destroy` del entorno; el bootstrap se conserva (cuesta centavos).

### Fase 1 — Calidad de infraestructura en CI  · rama `ci/infra-quality-gates`
- `terraform fmt -check`, `validate`, **tfsec**, **Checkov**, **Conftest/OPA** (`AWS-hcm/infra/policies/`): etiquetas obligatorias, sin NAT/EKS/ElastiCache/Aurora, sin buckets públicos, sin EIP sin asociar, RDS cifrado.
- **Infracost** comenta el costo mensual en cada PR; umbral: un PR que sube el costo mensual estimado > USD 10 exige justificación.
- Se integra en CI cuando el equipo estudie GitHub Actions (workflows en `Pendiente_Integrar/github-actions/`).

Puerta de salida: un PR de prueba con un NAT Gateway falla por política.

### Fase 2 — Red y seguridad base  · ramas `feat/infra-network`, `feat/infra-security`
- `network`: VPC, subredes públicas (2 AZ), **sin NAT**; VPC endpoints de tipo *gateway* (S3, DynamoDB). Security groups mínimos (ALB→API→RDS).
- `security`: KMS (una CMK por dominio: datos, secretos), Secrets Manager (`JWT_SECRET` sale: lo reemplaza Cognito; quedan `DOC_ENCRYPTION_KEY`, `DOC_HMAC_PEPPER`, credenciales de BD), WAF en CloudFront/ALB con reglas gestionadas básicas + límite de tasa por IP.
- **Rotar** `DOC_ENCRYPTION_KEY`/`DOC_HMAC_PEPPER` NO es una opción tras tener datos reales (rompe el índice HMAC y el descifrado): generarlos nuevos solo para la nube y documentarlo.

Puerta de salida: Checkov/tfsec sin hallazgos altos; ningún secreto en el repo ni en variables de Terraform en claro (`sensitive` + Secrets Manager).

### Fase 3 — Datos  · rama `feat/infra-data`
- **RDS PostgreSQL 17** (misma versión mayor que local), `db.t4g.micro`, single-AZ, cifrado KMS, backups automáticos + PITR (cumple "completo diario + WAL" y **RPO ≤ 5 min**). Multi-AZ solo para la demostración de la semana 13 (variable `multi_az = false` por defecto).
- **DynamoDB**: `hcm-public-profile` (PK `qr_token`) y `hcm-idempotency` (PK `idempotency_key`, TTL 7 días), modo *on-demand*.
- **S3 de evidencias**: cifrado, bloqueo público, CORS para PUT desde el origen web, ciclo de vida → **Glacier Instant Retrieval a los 90 días**.
- Migraciones en la nube: tarea ECS efímera (`pnpm db:migrate`) como paso del pipeline, **precedida por snapshot manual de RDS**. Reversión de esquema: `db:rollback` (ver §5).

Puerta de salida: `pnpm db:migrate` contra RDS desde CI; restauración de un snapshot probada una vez (con cronómetro: insumo para RTO ≤ 60 min).

### Fase 4 — Adaptadores AWS detrás de los puertos  · una rama por puerto
Es el único momento en que aparece `@aws-sdk/*`, y solo dentro de `apps/api/src/adapters/aws/`. Orden por riesgo creciente:

| # | Puerto | Adaptador local → AWS | Notas / trampas |
|---|---|---|---|
| 1 | `StoragePort` | carpeta + URL firmada local → **S3 presigned PUT** | Firma `getUploadUrl(key, mime)` intacta: el backend nunca recibe el binario. Límite de tamaño en la política de la URL (5 MB, RNF de subida <3 s). |
| 2 | `NotifyPort` | consola → **SNS** | Temas separados: recordatorios y alertas operativas. |
| 3 | `QueuePort` | cola en memoria → **SQS + DLQ** | `maxReceiveCount` = 3; alarma si la DLQ > 0 y si la cola > 5 000 mensajes (SLO de alertas). Los consumidores deben ser idempotentes (SQS entrega *al menos una vez*). |
| 4 | `OcrPort` | stub → **Textract** | `OCR_ENABLED=false` por defecto en TODOS los entornos; solo `prod` y por feature flag. Mantener la cuota diaria por dueño. Presupuesto específico para Textract. |
| 5 | `AuthPort` | JWT local → **Cognito** | Dos grupos (`duenos`, `veterinarios`); el acceso del validador a una mascota (RN 10, ≤ 4 h) sigue emitiéndolo la API con el `idMascota` en el token, firmado con KMS o con un secreto de Secrets Manager. Cuidado con el rol: hoy `verifyRoleToken` exige `role`. |
| 6 | `PublicReadPort` | consulta a Postgres → **DynamoDB** | Se hace *después* del proyector (fase 5). Debe responder aunque Postgres esté caído (RNF 7). |

Cada adaptador: tests contra un emulador o contra el servicio real en `dev` (no mocks que repitan la implementación), y se activa en `container.js` por variable de entorno **al arrancar**, nunca con `if` dentro de un caso de uso.
Puerta de salida por puerto: el mismo conjunto de tests de contrato del puerto pasa con ambos adaptadores.
Reversión: volver a la implementación local en `container.js` (un cambio de una línea) mientras la infraestructura siga arriba.

### Fase 5 — Workers (Lambda)  · ramas `feat/worker-*`
`workers/ocr`, `workers/normalizer`, `workers/reminders`, `workers/projector` (hoy solo `.gitkeep`; el código vive en `apps/api/src/workers/`).
- Extraer la lógica a `packages/` o importar desde la API sin duplicarla; el handler Lambda es una capa delgada.
- **Proyector**: Postgres → DynamoDB `hcm-public-profile` en cada cambio del expediente (evento de SQS / EventBridge). Reproceso total posible (idempotente).
- **Recordatorios**: EventBridge programado → fan-out con la clave de fecha con sufijo aleatorio 0-9 y consulta de las 10 particiones en paralelo (evita partición caliente, RNF 6). Dimensionar para el pico de 150 000/día.
- Cada Lambda con DLQ, concurrencia reservada acotada (protege a RDS) y alarma de errores.

Puerta de salida: reproceso de la proyección de todo el padrón de `dev` sin errores; el canal público sigue respondiendo con RDS detenido (prueba explícita).

### Fase 6 — Cómputo y borde  · ramas `feat/infra-compute`, `feat/infra-edge`
- ECR + **ECS Fargate** (la imagen de `apps/api/Dockerfile` tal cual) detrás de **ALB**; Application Auto Scaling por CPU/solicitudes con *scale-out* < 90 s (RNF de escalado). Mínimo 1 tarea en `dev`, 0 cuando está apagado.
- Web: build de Vite → S3 privado + **CloudFront** (OAC); la ficha pública cacheable corta en CloudFront.
- Route 53 + ACM (HTTPS obligatorio: la cámara del escáner lo exige).
- Despliegue: GitHub Actions `deploy.yml` con `needs: ci` (reutiliza `ci.yml`), imagen etiquetada con el SHA, *rolling update* con *circuit breaker* de ECS (revierte solo si el servicio no se estabiliza).

Puerta de salida: `GET /health` verde detrás del ALB; despliegue de una versión rota (health check falla) se revierte sola.

### Fase 7 — Observabilidad  · ramas `feat/obs-*`, `feat/ansible-obs`
- CloudWatch: alarmas por error > 1 %, latencia degradada > 20 %, cola > 5 000 → SNS → responsable en **< 1 min**.
- EC2 con **Prometheus + Grafana + Loki** (Docker Compose) configurada con **Ansible** (`ansible/`), encendida solo en sesiones de laboratorio; Loki **con redacción** (nada de DNI/teléfono/correo: ya redactado en pino, se verifica con un test de humo sobre los logs).
- Auditoría (RN 9): exportar `audit_log` a S3 con retención ≥ 5 años (Object Lock en modo gobernanza).

### Fase 8 — Resiliencia y pruebas de carga  · ramas `test/*`
- k6 (`load-tests/`) contra Fargate + DynamoDB con `OCR_ENABLED=false`: ficha pública p95 < 500 ms a 800 req/s (hoy solo se exige error rate 0 porque en local satura), historial de 200 eventos p95 < 2 s, camada < 3 s, albergue de 100 < 60 s.
- Semana 13: Multi-AZ encendido, *failover* de RDS, y medición de RTO/RPO; región secundaria para el canal público (< 15 min). **Apagar Multi-AZ al terminar.**
- Con los resultados, pasar de "diseñado" a "verificado" las NT de rendimiento (documentación del proyecto §17.4).

## 3. Presupuesto (estimación mensual en `dev` con uso de laboratorio)

| Concepto | Encendido 24/7 | Con `destroy` fuera de laboratorio |
|---|---|---|
| ALB | ~USD 17 | proporcional a horas |
| Fargate (1 tarea pequeña) | ~USD 10-15 | proporcional |
| RDS t4g.micro single-AZ + almacenamiento | ~USD 15-20 | puede detenerse (máx. 7 días) o destruirse con snapshot |
| DynamoDB on-demand, S3, SQS, Lambda, SNS | < USD 5 | — |
| CloudFront / WAF / Route 53 | ~USD 8-12 (WAF por regla) | WAF solo en la demostración |
| Textract | **0 con `OCR_ENABLED=false`** | tope con presupuesto propio |

Regla: sumar > USD 35/mes encendido es esperado; por eso la infraestructura se destruye. Control: Budgets (50/75/90 %), Infracost en PR, y un *checklist de apagado* al final de cada sesión:
`terraform destroy` del entorno, verificar en la consola que no quedan EIP, volúmenes EBS ni snapshots huérfanos, ni instancias de la EC2 de observabilidad.

## 4. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Se agota el presupuesto en una tarde (Textract, NAT, Multi-AZ olvidado) | Budgets desde el día 1, `OCR_ENABLED=false`, política OPA que prohíbe NAT, checklist de apagado. |
| Perder el acceso a datos cifrados | Las claves de `DOC_*` se respaldan en Secrets Manager con réplica; nunca solo en un `.env`. |
| Un `destroy` borra datos | `deletion_protection` en RDS de `prod`, `prevent_destroy` en el bucket de estado y de evidencias, snapshot final obligatorio. |
| Deriva entre local y nube | Mismas versiones mayores (Postgres 17, Node 20), misma imagen Docker, mismo `pnpm verify` como puerta. |
| Migración de esquema falla a media aplicación | Snapshot previo + `db:rollback` probado (ver §5) + migraciones aditivas (columna nueva con `DEFAULT`/nullable, borrado en un despliegue posterior). |
| Dependencia de una persona | Todo en Terraform + runbooks en `docs/`; el pipeline hace el `apply`, no la consola. |

## 5. Estrategia de migraciones y reversión (ya implementada en local)

- Cada migración `apps/api/migrations/NNNN_*.sql` tiene su par `apps/api/migrations-rollback/NNNN_*.down.sql`; un test lo exige y prueba el ciclo subir → bajar → subir en una base desechable.
- `pnpm db:backup` (pg_dump) antes de migrar; `pnpm db:rollback [n]` revierte las últimas *n* (solo contra bases locales; en la nube se usa una tarea ECS con `HCM_PERMITIR_BASE_REMOTA=si` y snapshot previo de RDS).
- Patrón *expand / contract* para despliegues sin caída: (1) migración que **agrega** (nullable o con `DEFAULT`), (2) se despliega el código que escribe/lee lo nuevo, (3) en un despliegue posterior, migración que **quita** lo viejo. Así el código anterior sigue funcionando si hay que volver atrás.
- La política "columna `NOT NULL` sin `DEFAULT`" está bloqueada por test (la migración 0001 se incluyó antes de la política).

## 6. Cómo se vuelve atrás una fase

1. Aplicación: redeploy de la imagen anterior (tag por SHA) o *circuit breaker* de ECS.
2. Adaptador: `container.js` vuelve al adaptador local (si la infraestructura sigue arriba) — no requiere tocar Terraform.
3. Infraestructura: `git revert` del PR de `AWS-hcm/infra/` y `terraform apply` del plan resultante; si es una fase entera, `terraform destroy` del módulo con snapshot previo de los datos.
4. Esquema de base de datos: `db:rollback` + restauración del snapshot si hubo pérdida de datos.

## 7. Orden sugerido de ramas (cada una con su PR y su `Refs:`)

```
chore/terraform-backend        → ci/infra-quality-gates → feat/infra-network → feat/infra-security
→ feat/infra-data              → feat/aws-adapter-storage → feat/aws-adapter-notify → feat/aws-adapter-queue
→ feat/aws-adapter-ocr         → feat/aws-adapter-auth    → feat/worker-projector → feat/aws-adapter-public-read
→ feat/worker-normalizer       → feat/worker-reminders    → feat/infra-compute → feat/infra-edge
→ feat/obs-cloudwatch          → feat/ansible-obs         → test/load-aws → test/failover-demo
```
