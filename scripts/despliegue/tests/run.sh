#!/usr/bin/env bash
# Pruebas de los scripts de despliegue sin tocar AWS: `aws`, `docker`, `pnpm` y `curl` son falsos y registran
# lo que reciben. Se corre con: bash scripts/despliegue/tests/run.sh
# shellcheck disable=SC2329  # las funciones t_* se invocan de forma indirecta desde `caso`
set -uo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
scripts="$aqui/.."
export AWS_REGION=us-east-2
export TAREA_JSON="$aqui/tarea-describe.json"

# Los binarios falsos se crean aquí, en una carpeta temporal: no dependen de permisos de archivo ni de cómo se
# copió el repositorio, y `PATH` los encuentra antes que los reales.
falsos="$(mktemp -d)"
trap 'rm -rf "$falsos"' EXIT
export PATH="$falsos:$PATH"

# `aws` falso: registra la llamada y responde según las variables de cada caso.
cat > "$falsos/aws" <<'FIN'
#!/usr/bin/env bash
# `aws` falso para las pruebas: registra la llamada y responde según las variables de cada caso.
echo "aws $*" >> "${BITACORA:?}"
case "$1 $2" in
  "secretsmanager describe-secret") if [ "${SECRETOS:-con}" = con ]; then echo "AWSCURRENT"; else echo "None"; fi ;;
  "secretsmanager put-secret-value") echo "version-nueva" ;;
  "ecr describe-images") [ "${IMAGEN_EXISTE:-no}" = si ] || exit 254 ;;
  "ecr get-login-password") echo "token-falso" ;;
  "ecs describe-task-definition") cat "${TAREA_JSON:?}" ;;
  "ecs register-task-definition")
    while [ $# -gt 0 ]; do
      if [ "$1" = "--cli-input-json" ]; then printf '%s' "$2" > "${ENTRADA_TAREA:?}"; fi
      shift
    done
    echo "arn:aws:ecs:us-east-2:111111111111:task-definition/hcm-api:3"
    ;;
  "ecs describe-services") echo '{"subnets":["subnet-a","subnet-b"],"securityGroups":["sg-1"],"assignPublicIp":"ENABLED"}' ;;
  "ecs run-task") if [ "${RUNTASK:-ok}" = ok ]; then echo "arn:aws:ecs:us-east-2:111111111111:task/hcm-cluster/abc"; else echo "None"; fi ;;
  "ecs describe-tasks") echo "${CODIGO_SALIDA:-0}" ;;
  "logs tail") echo "linea de log falsa" ;;
  *) ;;
esac
FIN
# `docker` falso: registra la llamada y, como el real, lee la entrada estándar solo con --password-stdin.
cat > "$falsos/docker" <<'FIN'
#!/usr/bin/env bash
# `docker` falso: registra la llamada y, como el real, lee la entrada estándar solo con --password-stdin.
echo "docker $*" >> "${BITACORA:?}"
if [[ "$*" == *"--password-stdin"* ]]; then cat > /dev/null; fi
FIN
cat > "$falsos/pnpm" <<'FIN'
#!/usr/bin/env bash
echo "pnpm $* VITE_API_URL=${VITE_API_URL:-}" >> "${BITACORA:?}"
FIN
cat > "$falsos/curl" <<'FIN'
#!/usr/bin/env bash
echo "curl $*" >> "${BITACORA:?}"
if [[ "$*" == *"/api/health"* ]]; then
  if [ "${CURL_API:-ok}" = ok ]; then echo '{"status":"ok"}'; else exit 22; fi
else
  echo "${CURL_WEB:-200}"
fi
FIN
chmod +x "$falsos"/*
BITACORA="$(mktemp)"
ENTRADA_TAREA="$(mktemp)"
export BITACORA ENTRADA_TAREA
salida="$(mktemp)"
fallos=0

# Cada prueba corre en un subshell con `set -e` como comando simple: si se la llamara desde un `if`, bash
# ignoraría `set -e` dentro y solo contaría la última línea; así cualquier aserción que falle cuenta.
caso() {
  local nombre=$1
  shift
  : > "$BITACORA"
  (
    set -e
    "$@"
  ) > "$salida" 2>&1
  local estado=$?
  if [ "$estado" -eq 0 ]; then
    echo "ok     $nombre"
  else
    echo "FALLA  $nombre"
    sed 's/^/         /' "$salida" | tail -8
    fallos=$((fallos + 1))
  fi
}

ECR="111111111111.dkr.ecr.us-east-2.amazonaws.com/hcm-api"

t_secretos_existentes_no_se_tocan() {
  set -e
  out=$(SECRETOS=con bash "$scripts/cargar-secretos.sh")
  [[ "$out" == *"ya tiene valor: hcm/doc-encryption-key"* ]]
  [[ $(grep -c "describe-secret" "$BITACORA") -eq 3 ]]
  ! grep -q "put-secret-value" "$BITACORA"
}

t_secretos_nuevos_se_cargan_sin_mostrar_el_valor() {
  set -e
  out=$(SECRETOS=sin bash "$scripts/cargar-secretos.sh")
  [[ $(grep -c "put-secret-value" "$BITACORA") -eq 3 ]]
  while read -r valor; do
    [[ "$out" != *"$valor"* ]]
  done < <(grep "put-secret-value" "$BITACORA" | sed -E 's/.*--secret-string ([^ ]+).*/\1/')
  clave=$(grep "put-secret-value.*doc-encryption-key" "$BITACORA" | sed -E 's/.*--secret-string ([^ ]+).*/\1/')
  [[ $(printf '%s' "$clave" | base64 -d | wc -c) -eq 32 ]]
}

t_imagen_existente_no_se_sube_otra_vez() {
  set -e
  out=$(IMAGEN_EXISTE=si REPOSITORIO_ECR="$ECR" ETIQUETA=abc123 bash "$scripts/publicar-imagen.sh" 2> /dev/null)
  [[ "$out" == "$ECR:abc123" ]]
  ! grep -q "docker push" "$BITACORA"
}

t_imagen_nueva_se_construye_y_se_sube() {
  set -e
  out=$(IMAGEN_EXISTE=no REPOSITORIO_ECR="$ECR" ETIQUETA=abc123 bash "$scripts/publicar-imagen.sh" 2> /dev/null)
  [[ "$out" == "$ECR:abc123" ]]
  grep -q "docker login --username AWS" "$BITACORA"
  grep -q "docker build -f apps/api/Dockerfile -t $ECR:abc123" "$BITACORA"
  grep -q "docker push $ECR:abc123" "$BITACORA"
}

t_registrar_tarea_solo_cambia_la_imagen() {
  set -e
  nueva="$ECR:abc123"
  out=$(bash "$scripts/registrar-tarea.sh" "$nueva")
  [[ "$out" == *"task-definition/hcm-api:3" ]]
  jq -e --arg n "$nueva" '.containerDefinitions[0].image == $n' "$ENTRADA_TAREA" > /dev/null
  # lo demás se conserva
  jq -e '.family == "hcm-api" and .cpu == "256" and .memory == "512" and .networkMode == "awsvpc"
         and (.containerDefinitions[0].environment | length) == 2
         and .containerDefinitions[0].secrets[0].name == "JWT_SECRET"
         and .containerDefinitions[0].logConfiguration.logDriver == "awslogs"
         and .taskRoleArn != null and .executionRoleArn != null' "$ENTRADA_TAREA" > /dev/null
  # los campos que la API rechaza no pasan
  jq -e '(has("revision") or has("status") or has("taskDefinitionArn") or has("registeredAt") or has("compatibilities") or has("requiresAttributes")) | not' "$ENTRADA_TAREA" > /dev/null
  # y no hay ninguna clave fuera de la lista oficial de register-task-definition
  jq -e '[keys[]] - ["containerDefinitions","cpu","enableFaultInjection","ephemeralStorage","executionRoleArn","family","inferenceAccelerators","ipcMode","memory","networkMode","pidMode","placementConstraints","proxyConfiguration","requiresCompatibilities","runtimePlatform","tags","taskRoleArn","volumes"] | length == 0' "$ENTRADA_TAREA" > /dev/null
}

t_migracion_correcta() {
  set -e
  out=$(CLUSTER=hcm-cluster SERVICIO=hcm-api bash "$scripts/migrar-bd.sh" "arn:aws:ecs:us-east-2:1:task-definition/hcm-api:3")
  [[ "$out" == *"migraciones aplicadas"* ]]
  grep -q "run-task" "$BITACORA"
  grep -q "subnets=\[subnet-a,subnet-b\],securityGroups=\[sg-1\],assignPublicIp=ENABLED" "$BITACORA"
  grep -q "node src/db/migrate.js" "$BITACORA"
  grep -q -- "--task-definition arn:aws:ecs:us-east-2:1:task-definition/hcm-api:3" "$BITACORA"
}

t_migracion_con_codigo_distinto_de_cero_falla() {
  if CODIGO_SALIDA=1 CLUSTER=hcm-cluster SERVICIO=hcm-api bash "$scripts/migrar-bd.sh" "arn:x" > /dev/null 2>&1; then
    return 1
  fi
  grep -q "logs tail" "$BITACORA"
}

t_migracion_sin_tarea_falla() {
  ! RUNTASK=no CLUSTER=hcm-cluster SERVICIO=hcm-api bash "$scripts/migrar-bd.sh" "arn:x" > /dev/null 2>&1
}

t_lambdas_actualizan_las_cuatro() {
  set -e
  bash "$scripts/actualizar-lambdas.sh" > /dev/null
  [[ $(grep -c "lambda update-function-code" "$BITACORA") -eq 4 ]]
  for f in proyector normalizador recordatorios notificador; do
    grep -q "update-function-code.*--function-name hcm-$f.*fileb://workers/dist/$f.zip" "$BITACORA"
  done
}

t_web_se_compila_con_api_relativa_y_se_invalida_la_cache() {
  set -e
  BUCKET_WEB=hcm-web-1 ID_DISTRIBUCION=E1ABC bash "$scripts/publicar-web.sh" > /dev/null
  grep -q "pnpm --filter @hcm/web build VITE_API_URL=/api" "$BITACORA"
  grep -q "s3 sync apps/web/dist s3://hcm-web-1 --delete" "$BITACORA"
  grep -q "create-invalidation --distribution-id E1ABC --paths /\*" "$BITACORA"
}

t_humo_correcto() {
  set -e
  out=$(PAUSA=0 bash "$scripts/probar-humo.sh" ejemplo.cloudfront.net)
  [[ "$out" == *"la API responde sana"* && "$out" == *"la web se sirve"* ]]
}

t_humo_falla_si_la_api_no_responde() {
  ! CURL_API=mal INTENTOS=2 PAUSA=0 bash "$scripts/probar-humo.sh" ejemplo.cloudfront.net > /dev/null 2>&1
}

t_humo_falla_si_la_web_no_da_200() {
  ! CURL_WEB=502 PAUSA=0 bash "$scripts/probar-humo.sh" ejemplo.cloudfront.net > /dev/null 2>&1
}

caso "secretos existentes no se tocan" t_secretos_existentes_no_se_tocan
caso "secretos nuevos se cargan sin mostrar el valor" t_secretos_nuevos_se_cargan_sin_mostrar_el_valor
caso "imagen existente no se sube otra vez" t_imagen_existente_no_se_sube_otra_vez
caso "imagen nueva se construye y se sube" t_imagen_nueva_se_construye_y_se_sube
caso "la nueva tarea solo cambia la imagen" t_registrar_tarea_solo_cambia_la_imagen
caso "migración correcta" t_migracion_correcta
caso "migración con código distinto de 0 falla" t_migracion_con_codigo_distinto_de_cero_falla
caso "migración sin tarea falla" t_migracion_sin_tarea_falla
caso "las cuatro Lambdas se actualizan" t_lambdas_actualizan_las_cuatro
caso "la web usa /api y se invalida la caché" t_web_se_compila_con_api_relativa_y_se_invalida_la_cache
caso "prueba de humo correcta" t_humo_correcto
caso "prueba de humo falla si la API no responde" t_humo_falla_si_la_api_no_responde
caso "prueba de humo falla si la web no da 200" t_humo_falla_si_la_web_no_da_200

rm -f "$BITACORA" "$ENTRADA_TAREA" "$salida"
echo
if [ "$fallos" -eq 0 ]; then echo "todas las pruebas pasan"; else echo "$fallos prueba(s) fallan"; fi
exit "$fallos"
