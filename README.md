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

## Avance del código

El código se sube por piezas, cada una en su Pull Request. Hasta ahora:

- **Base del monorepo** (pnpm workspace, ESLint, scripts de verificación). `pnpm install && pnpm lint`.
- **Contrato compartido** (`packages/shared`): esquemas zod y código público con dígito verificador.
- **Base de datos** (`apps/api`): esquema Drizzle, migraciones con reversión, cifrado de columna, auditoría y tokens.
- **Puertos y adaptadores locales** (`apps/api/src/ports`, `adapters/local`): todo servicio externo detrás de una interfaz.
- **Cuentas y login**: dueños y veterinarios, inicio de sesión con código de 6 dígitos por correo.
- **Adaptadores AWS** (`adapters/aws`): S3, SQS, SES, DynamoDB y Secrets Manager, activos con `PROVEEDOR=aws`.
- **Terraform base** (`infra/`): bootstrap, presupuesto, OIDC de GitHub, red y seguridad. Ver `PLAN-MIGRACION-AWS.md`.
