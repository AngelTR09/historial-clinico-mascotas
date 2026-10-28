# Scripts de despliegue

Lo que hay que hacer después de `terraform apply` para que la aplicación funcione. Los ejecuta el workflow
`.github/workflows/deploy.yml` en este orden; también se pueden correr a mano con las variables de cada uno.

| Script | Qué hace | Variables | Idempotente |
|---|---|---|---|
| `cargar-secretos.sh` | Carga el valor de los tres secretos de la API (`doc-encryption-key`, `doc-hmac-pepper`, `firma-acceso-vet`). Los valores se generan al vuelo y no se imprimen. | `AWS_REGION` | Sí: **nunca** rota un secreto que ya tiene valor (cambiar la clave de cifrado dejaría ilegibles los datos). |
| `publicar-imagen.sh` | Construye y sube la imagen de la API a ECR. | `AWS_REGION`, `REPOSITORIO_ECR`, `ETIQUETA` | Sí: las etiquetas son inmutables, una que ya existe no se vuelve a subir. |
| `registrar-tarea.sh <imagen>` | Registra una revisión de la definición de tarea con esa imagen. Terraform no lo hace: el servicio ignora los cambios de su definición. | `AWS_REGION` | Cada llamada crea una revisión nueva. |
| `migrar-bd.sh <tarea>` | Corre las migraciones y el seed con una tarea efímera de ECS, en la red del servicio. Falla si el código de salida no es 0. | `AWS_REGION`, `CLUSTER`, `SERVICIO` | Sí: las migraciones aplicadas se saltan. |
| `actualizar-lambdas.sh` | Sube el código de las cuatro Lambdas (Terraform ignora su paquete después de crearlas). | `AWS_REGION` | Sí |
| `publicar-web.sh` | Compila la web con `VITE_API_URL=/api`, la sincroniza con el bucket e invalida CloudFront. | `AWS_REGION`, `BUCKET_WEB`, `ID_DISTRIBUCION` | Sí |
| `probar-humo.sh <dominio>` | Comprueba que la API responde sana por CloudFront y que la web se sirve. | — | Sí |

## Lo que sigue siendo manual

Llega por correo y no se puede automatizar: abrir el enlace de verificación de SES (sin él no salen los códigos de
inicio de sesión) y confirmar la suscripción de alertas de SNS.

## Pruebas

`bash scripts/despliegue/tests/run.sh` prueba cada script con un `aws`, `docker`, `pnpm` y `curl` falsos que registran lo
que reciben; no toca AWS. Comprueba, entre otras cosas, que un secreto existente no se rota, que la definición de tarea
nueva solo cambia la imagen y no lleva campos que la API rechaza, y que una migración con código de salida distinto
de 0 detiene el despliegue. CI las corre junto con `shellcheck` en cada pull request.

## Permisos que usan

Todos caben en la política del rol de despliegue (`lab09-github-actions-dev-terraform`): Secrets Manager, ECR, ECS
(con `iam:PassRole` a los roles `hcm-*`), Lambda, S3 (buckets del proyecto), CloudFront y CloudWatch Logs, siempre en
la región del laboratorio.
