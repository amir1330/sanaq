#!/bin/sh
set -eu
cd /root/coffeeos

if [ -z "${GHCR_TOKEN:-}" ]; then
  echo "GHCR_TOKEN is missing. CI must send X-Ghcr-Token (GITHUB_TOKEN)." >&2
  exit 1
fi

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-amir1330}" --password-stdin >/dev/null

DC="docker compose --compatibility"
FILE="-f docker-compose.prod.yml"

echo "Pulling CoffeeOS images..."
$DC $FILE pull backend nginx

echo "Recreating backend and nginx..."
$DC $FILE up -d --no-build --force-recreate --remove-orphans backend nginx

echo "Deploy complete."
