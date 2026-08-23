#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose pull || true
docker compose build
docker compose up -d
echo "CoffeeOS deployed"
