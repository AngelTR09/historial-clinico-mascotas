# use-cases: un dominio por carpeta

Cada subcarpeta es una capacidad del negocio. Dentro: `verbo-sustantivo.js` y su `.test.js` al lado.
Los casos de uso reciben los puertos por parámetro; nunca importan adaptadores, rutas ni plugins (ESLint lo impide).

| Carpeta | Qué resuelve | Ruta HTTP | Requisitos que sostiene |
|---|---|---|---|
| `accounts/` | Alta de dueño y veterinario, login con código de 6 dígitos | `/owners`, `/vets`, `/auth/*` | RNF 03, 06 · RN 4 |
| `pets/` | Mascota, foto, estado (extraviada), transferencia de datos de ficha; camada y carga masiva (2.º incremento) | `/pets` | RNF 13, 16 · RN 1 |
| `health/` | Eventos de salud, correcciones, evidencias con URL de subida directa | `/health-events`, `/attachments` | RNF 01, 04 · RN 2, 6, 7, 8 |
| `vets/` | Acceso temporal de 4 h por QR, registro directo del veterinario, alta de mascota por veterinario | `/vets/*`, `/pets/:id/vet-view` | RNF 03, 16 · RN 3, 10 |
| `transfers/` | Transferencia de titularidad con código de un solo uso | `/transfers` | RNF 14, 17 |
| `reminders/` | Vencimientos de vacunas y recordatorios | `/reminders` | RNF 15, 18 |
| `public/` | Ficha pública y contacto enmascarado | `/public/*` | RNF 02, 16 · RN 1, 5 |

**Añadir un caso de uso:** créalo en la carpeta de su dominio, con su test, y regístralo en la ruta correspondiente. Si es un dominio nuevo, añade una fila a esta tabla.
