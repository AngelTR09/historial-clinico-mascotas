# apps/api/src

Fastify + Drizzle. La carpeta de primer nivel indica la **capa**; dentro de `use-cases/` la subcarpeta indica el **dominio**.

| Carpeta | Qué hay | Puede importar |
|---|---|---|
| `routes/` | Rutas HTTP, una por recurso. Validan con zod y delegan. | `use-cases`, `plugins`, `@hcm/shared` |
| `use-cases/<dominio>/` | Reglas de negocio (`verbo-sustantivo.js` + su `.test.js`). | `ports`, `db`, `domain`, `crypto`, `audit` |
| `ports/` | Contratos JSDoc: Storage, Queue, Notify, Auth, Ocr, PublicRead. | nada del proveedor |
| `adapters/local/` | Implementación de hoy (carpeta, cola en memoria, consola). | `ports` |
| `adapters/aws/` | S3, SQS, SNS, DynamoDB. **Único lugar con `@aws-sdk/*`.** | `ports` |
| `workers/` | Consumidores de cola (normalizador, recordatorios, carga masiva, OCR). | `use-cases`, `ports` |
| `container.js`, `container-aws.js` | Único punto que elige adaptadores según `PROVEEDOR`. | todo |

Dominios de `use-cases/`: `accounts`, `pets`, `health`, `transfers`, `vets`, `reminders`, `public`.

ESLint hace cumplir las fronteras: un caso de uso no importa `adapters/`, `routes/` ni `plugins/`.
**Para añadir un caso de uso:** ponlo en la carpeta de su dominio (o crea una si es un dominio nuevo), con su test al lado.
