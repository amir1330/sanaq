# Sanaq

Касса, склад и прибыль для точки: кафе, магазин, пекарня.

## Запуск локально

```bash
docker compose up --build
```

Открыть [http://localhost:8080](http://localhost:8080).

Только если `SEED_DEMO=1` (так в локальном `docker-compose.yml`):

| Роль | Логин | Пароль |
|---|---|---|
| Super admin | `admin@coffeeos.local` | `admin123` |
| Owner | `owner@erassyl.local` | `owner123` |
| Кассир | `barista@erassyl.local` | `barista123` |

Касса: `/pin`, точка `1`, PIN `1234`.

## CI/CD

GitHub Actions собирает образы в GHCR и по SSH обновляет VPS. На сервере нет git и нет вебхука.

1. Push в `main` → тесты → образы `ghcr.io/amir1330/sanaq/backend` и `.../nginx` (`:latest` и `:<sha>`).
2. Тот же job по SSH копирует `docker-compose.prod.yml` и делает `pull` + recreate только `backend` и `nginx`. Postgres не трогаем.
3. Логин в GHCR на сервере — короткоживущий `GITHUB_TOKEN` этого прогона. Вечный PAT на VPS не нужен.

Секреты репозитория (Settings → Secrets → Actions):

| Secret | Зачем |
|---|---|
| `HOST` | IP VPS |
| `USERNAME` | пользователь SSH, обычно `root` |
| `SSH_KEY` | отдельный deploy-ключ, не личный ноутбук |

`POSTGRES_PASSWORD` и `SECRET_KEY` живут только в `/root/coffeeos/.env` на сервере.

## Стек

FastAPI + PostgreSQL 16 + React/Vite. Прод: Traefik на `coffee.abuyunus.cc`.
