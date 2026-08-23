#!/bin/sh
set -e
cd /root/coffeeos

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u amir1330 --password-stdin >/dev/null
fi

echo "Pulling CoffeeOS images..."
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

$DC -f docker-compose.prod.yml pull backend nginx

docker stop coffeeos_nginx_1 coffeeos_backend_1 2>/dev/null || true
docker rm coffeeos_nginx_1 coffeeos_backend_1 2>/dev/null || true

$DC -f docker-compose.prod.yml up -d

echo "Pruning old images..."
docker image prune -f

echo "Deploy complete."
