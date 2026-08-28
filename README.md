# Санақ

Касса, склад и прибыль для точки: кафе, магазин, пекарня.

Чек, смена, остатки и чистыми в одном месте — без сведения таблиц в конце месяца.

[Живой стенд](https://sanaq.abuyunus.cc) · [Actions](https://github.com/amir1330/sanaq/actions)

[![CI](https://github.com/amir1330/sanaq/actions/workflows/ci.yml/badge.svg)](https://github.com/amir1330/sanaq/actions/workflows/ci.yml)

## Что умеет

| | |
|---|---|
| **Касса** | Сотрудник входит почтой и паролем, видит только кассу. Нал и безнал, чек за два касания. |
| **Склад** | Позиции: молоко, стаканы, готовое печенье. Состав списывает сам; без состава — только касса. Журнал, приход, ревизия. |
| **Смены** | Открытие, инкассация, закрытие. Расхождение видно сразу. |
| **Деньги** | Себестоимость и чистыми на дашборде. Выгрузка в Excel. |
| **Филиалы** | Несколько точек у одного владельца, переключение в шапке. |
| **Фискализация** | Webkassa по желанию, по умолчанию выключена. |

Роли: суперадмин, владелец, кассир. Данные жёстко режутся по точке (`shop_id`).

## Стек

- Backend: Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL 16
- Frontend: React 19, Vite, TypeScript, Tailwind, TanStack Query, Zustand
- Прод: Docker-образы в GHCR, Traefik, GitHub Actions по SSH (forced-command, не root)

## Разработка

Локальный Docker-стек не используем — проверяем на [живом стенде](https://sanaq.abuyunus.cc) после push в `main` (CI деплоит автоматически).

Если нужно только покрутить UI до деплоя:

```bash
cd frontend
cp .env.local.example .env.local   # set VITE_API_PROXY — required
npm install
npm run dev
```

`npm run dev` **will not start** without `VITE_API_PROXY` in `.env.local` (avoids accidentally proxying to prod). For UI-only work against the live stand, set `VITE_API_PROXY=https://sanaq.abuyunus.cc` explicitly — that mutates production data.

Бэкенд-тесты в CI: `docker build ./backend && docker run … pytest`.

## Структура

```
backend/    FastAPI, миграции, тесты
frontend/   React-кабинет и касса
nginx/      статика + прокси /api
deploy/     bootstrap, provision ключа и remote.sh для Actions
```

## Деплой

Тот же hardened-паттерн, что у **telegram-queue-bot**:

1. GitHub Actions гоняет тесты, затем собирает и пушит `ghcr.io/amir1330/sanaq/backend` и `.../nginx` (`:latest` и `:<sha>`).
2. CI заходит по SSH **не root**, пользователь **`sanaq`**, ключ с **forced-command**.
3. Remote `deploy/ci-entry.sh` принимает только `sync-deploy` / `deploy`.
4. Host key запинен в `.github/known_hosts` (`StrictHostKeyChecking=yes`).
5. Recreate только `backend` и `nginx`. Postgres и volume `coffeeos_postgres_data` не трогаем.

Вебхука нет. Root SSH из CI нет. Логин в GHCR — на время джоба, через `GITHUB_TOKEN`. Нужен Docker Compose v2: v1.29 падает на образах из GHCR.

### Одноразовый VPS + secrets

С ноутбука (`gh` auth + SSH как root один раз):

```bash
chmod +x deploy/provision-ci-key.sh
./deploy/provision-ci-key.sh
```

Создаёт пользователя `sanaq` (группа `docker`), ставит restricted-ключ и секреты репо `HOST`, `USERNAME`, `SSH_KEY`.

### Каталог на сервере

| Path | Purpose |
|---|---|
| `/home/sanaq/coffeeos/` | compose + `.env` (пароли БД, `SECRET_KEY`) |
| `/home/sanaq/bin/ci-entry.sh` | forced-command entrypoint |

Имя compose-проекта остаётся **`coffeeos`**, чтобы не создать новые пустые volume вместо `coffeeos_postgres_data` и `coffeeos_uploads`.

### GitHub secrets

| Secret | Value |
|---|---|
| `HOST` | IP VPS |
| `USERNAME` | `sanaq` |
| `SSH_KEY` | private key (forced-command) |

**Никогда не коммить** `POSTGRES_PASSWORD` / `SECRET_KEY`. Они только в `.env` на сервере.

## Лицензия

[AGPLv3](LICENSE).
