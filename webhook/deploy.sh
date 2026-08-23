#!/bin/sh
set -eu
cd /root/coffeeos

if [ -z "${DEPLOY_TOKEN:-}" ]; then
  echo "DEPLOY_TOKEN is not set in the webhook container" >&2
  exit 1
fi

if [ -n "${GHCR_TOKEN:-}" ]; then
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u amir1330 --password-stdin >/dev/null
fi

# Compose v2 inside this image. --compatibility keeps the existing coffeeos_* names.
DC="docker compose --compatibility"
FILE="-f docker-compose.prod.yml"

echo "Pulling CoffeeOS images..."
$DC $FILE pull backend nginx

echo "Recreating backend and nginx..."
$DC $FILE up -d --no-build --force-recreate --remove-orphans backend nginx

echo "Deploy complete."
