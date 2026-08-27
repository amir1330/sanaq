#!/bin/sh
set -eu
APP_DIR="${SANAQ_APP:-/home/sanaq/coffeeos}"
cd "$APP_DIR"

# Prefer env from CI (sync-deploy); else optional GHCR_TOKEN in .env for manual runs.
if [ -z "${GHCR_TOKEN:-}" ] && [ -f .env ]; then
  # shellcheck disable=SC1091
  GHCR_TOKEN=$(grep -E '^GHCR_TOKEN=' .env | tail -n1 | cut -d= -f2- || true)
  GHCR_USER=$(grep -E '^GHCR_USER=' .env | tail -n1 | cut -d= -f2- || true)
  export GHCR_TOKEN GHCR_USER
fi

if [ -z "${GHCR_TOKEN:-}" ]; then
  echo "GHCR_TOKEN is missing (pass via CI or set in .env)" >&2
  exit 1
fi

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-amir1330}" --password-stdin >/dev/null

if docker compose version >/dev/null 2>&1; then
  DC="docker compose --compatibility"
else
  DC="docker-compose"
fi
FILE="-f docker-compose.prod.yml"
# Keep the historical compose project so coffeeos_postgres_data / coffeeos_uploads stay attached.
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-coffeeos}"

echo "Pulling images..."
$DC $FILE pull backend nginx
docker logout ghcr.io >/dev/null 2>&1 || true

echo "Recreating backend and nginx (postgres untouched)..."
$DC $FILE up -d --no-build --no-deps --force-recreate backend nginx

for name in coffeeos_webhook_1 coffeeos-webhook-1; do
  if docker inspect "$name" >/dev/null 2>&1; then
    echo "Removing $name..."
    docker rm -f "$name"
  fi
done

docker image prune -f
echo "Deploy complete."
