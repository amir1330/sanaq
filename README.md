# CoffeeOS

Учёт для кофейни: касса, склад с себестоимостью, смены, расходы и отчёты по прибыли.

## Запуск

```bash
docker compose up --build
```

Открыть [http://localhost:8080](http://localhost:8080).

Локально, только если `SEED_DEMO=1` (так в `docker-compose.yml`):

| Роль | Логин | Пароль |
|---|---|---|
| Super admin | `admin@coffeeos.local` | `admin123` |
| Owner | `owner@erassyl.local` | `owner123` |
| Barista | `barista@erassyl.local` | `barista123` |

Касса: `/pin`, точка `1`, PIN `1234`.

## Локальная разработка

```bash
docker compose up postgres
# Postgres на хосте: localhost:5433
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head && python -m app.seed
uvicorn app.main:app --reload
cd ../frontend && npm install && npm run dev
```

Фронт на :5173 проксирует `/api` на backend :8000.

## CI/CD

Как у gym-tracker и queue-bot: GitHub Actions собирает образы в GHCR и дергает webhook на VPS.

1. Приватный репозиторий. Секреты только в GitHub Actions и в `/root/coffeeos/.env` на сервере. В git их нет.
2. Push в `main` → `.github/workflows/ci.yml`: тесты, потом образы в GHCR (`:latest` и `:<sha>`).
3. POST `http://VPS:9002/hooks/deploy` с `X-Deploy-Token` и `X-Ghcr-Token` (короткий `GITHUB_TOKEN` из этого же job). Без токена деплоя — 403, упавший скрипт — 500.
4. Webhook логинится в GHCR, тянет образы и пересоздаёт `backend` и `nginx`. На сервере вечный PAT не нужен.

Секреты репозитория (Settings → Secrets → Actions):

| Secret | Куда |
|---|---|
| `VPS_HOST` | IP сервера |
| `DEPLOY_TOKEN` | тот же, что `DEPLOY_TOKEN` в `.env` на сервере |

`POSTGRES_PASSWORD` и `SECRET_KEY` живут только на сервере.

## Стек

FastAPI + PostgreSQL 16 + React/Vite. Схема и API — в `coffee-erp-plan.md`.
