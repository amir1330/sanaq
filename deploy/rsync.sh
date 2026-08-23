#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-root@89.167.79.221}"
DEST="${DEPLOY_DIR:-/root/coffeeos}"

rsync -az --delete \
  --exclude '.git' \
  --exclude 'frontend/node_modules' \
  --exclude 'backend/.venv' \
  --exclude 'backend/.pytest_cache' \
  --exclude '.env' \
  --exclude '*.gpg' \
  --exclude 'coffeeERP.gpg' \
  "$ROOT/" "$HOST:$DEST/"

ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $DEST
if [ ! -f .env ]; then
  umask 077
  printf 'POSTGRES_PASSWORD=%s\nSECRET_KEY=%s\n' \
    "\$(openssl rand -hex 16)" "\$(openssl rand -hex 32)" > .env
fi
docker ps -aq --filter name=coffeeos_backend --filter name=coffeeos_nginx | xargs -r docker rm -f
if docker compose version >/dev/null 2>&1; then
  docker compose -f docker-compose.prod.yml up -d --build
else
  docker-compose -f docker-compose.prod.yml up -d --build
fi
REMOTE
