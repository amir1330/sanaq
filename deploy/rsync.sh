#!/bin/bash
# Emergency copy of compose to the VPS. Everyday deploys go through GitHub Actions.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-root@89.167.79.221}"
DEST="${DEPLOY_DIR:-/root/coffeeos}"

scp "$ROOT/docker-compose.prod.yml" "$ROOT/deploy/remote.sh" "$HOST:$DEST/"
echo "Copied compose. Push to main to build images, or SSH and run deploy/remote.sh after docker login."
