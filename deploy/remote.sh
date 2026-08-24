#!/bin/sh
set -eu
cd /root/coffeeos

if [ -z "${GHCR_TOKEN:-}" ]; then
  echo "GHCR_TOKEN is missing" >&2
  exit 1
fi

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-amir1330}" --password-stdin >/dev/null

if docker compose version >/dev/null 2>&1; then
  DC="docker compose --compatibility"
else
  DC="docker-compose"
fi
FILE="-f docker-compose.prod.yml"

echo "Pulling images..."
$DC $FILE pull backend nginx
docker logout ghcr.io >/dev/null 2>&1 || true

echo "Recreating backend and nginx..."
$DC $FILE up -d --no-build --no-deps --force-recreate backend nginx

old=$(docker ps -aq --filter name=coffeeos_webhook --filter name=coffeeos-webhook)
if [ -n "$old" ]; then
  echo "Removing webhook listener..."
  docker rm -f $old
fi

docker image prune -f
echo "Deploy complete."
