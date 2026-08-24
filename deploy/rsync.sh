#!/bin/bash
# Emergency copy of compose to the VPS. Everyday deploys go through GitHub Actions.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-root@89.167.79.221}"
DEST="${DEPLOY_DIR:-/root/coffeeos}"

scp "$ROOT/docker-compose.prod.yml" "$HOST:$DEST/"
ssh "$HOST" "mkdir -p $DEST/deploy"
scp "$ROOT/deploy/remote.sh" "$HOST:$DEST/deploy/remote.sh"
echo "Copied compose. Everyday deploys go through GitHub Actions."
