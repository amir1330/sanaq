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

docker ps -aq --filter name=coffeeos_backend --filter name=coffeeos_nginx | xargs -r docker rm -f


$DC -f docker-compose.prod.yml up -d

echo "Pruning old images..."
docker image prune -f

echo "Deploy complete."
