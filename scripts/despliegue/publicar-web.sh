#!/usr/bin/env bash
# Compila la web y la publica: sincroniza el build con el bucket e invalida la caché de CloudFront.
# VITE_API_URL=/api hace que la web llame a su mismo dominio; CloudFront reenvía /api/* al balanceador.
set -euo pipefail

region="${AWS_REGION:?Falta AWS_REGION}"
bucket="${BUCKET_WEB:?Falta BUCKET_WEB}"
distribucion="${ID_DISTRIBUCION:?Falta ID_DISTRIBUCION}"

VITE_API_URL=/api pnpm --filter @hcm/web build
aws s3 sync apps/web/dist "s3://$bucket" --delete --region "$region"
aws cloudfront create-invalidation --distribution-id "$distribucion" --paths "/*" --query Invalidation.Id --output text
