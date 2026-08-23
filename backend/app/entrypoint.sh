#!/bin/sh
set -e
alembic upgrade head
python -m app.seed
exec gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers "${WEB_CONCURRENCY:-2}" \
  --bind 0.0.0.0:8000 \
  --timeout 60
