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
- Прод: Docker-образы в GHCR, Traefik, GitHub Actions по SSH

## Запуск локально

Нужны Docker и Docker Compose v2.

```bash
git clone https://github.com/amir1330/sanaq.git
cd sanaq
docker compose up --build
```

Открыть [http://localhost:8080](http://localhost:8080).

Локальный compose поднимает демо-данные (`SEED_DEMO=1`). На проде сид выключен.

| Роль | Как войти |
|---|---|
| Super admin | `admin@coffeeos.local` / `admin123` |
| Owner | `owner@erassyl.local` / `owner123` |
| Сотрудник | `barista@erassyl.local` / `barista123` → касса |

Только локальная демка. На живом стенде эти пароли не работают.

## Структура

```
backend/    FastAPI, миграции, тесты
frontend/   React-кабинет и касса
nginx/      статика + прокси /api
deploy/     скрипт, который гоняет Actions на VPS
```

## Деплой

Push в `main`:

1. Тесты бэкенда.
2. Сборка и пуш `ghcr.io/amir1330/sanaq/backend` и `.../nginx` (`:latest` и `:<sha>`).
3. SSH на VPS: `pull` и recreate только `backend` и `nginx`. Postgres не трогаем.

На сервере нет git и нет вебхука. Логин в GHCR — на время джоба, через `GITHUB_TOKEN`. Нужен Docker Compose v2: v1.29 падает на образах из GHCR.

Секреты репозитория (Settings → Secrets → Actions):

| Secret | Зачем |
|---|---|
| `HOST` | IP VPS |
| `USERNAME` | пользователь SSH |
| `SSH_KEY` | отдельный deploy-ключ, не ключ с ноутбука |

Пароли базы и `SECRET_KEY` живут только в `.env` на сервере, в git их нет.

## Лицензия

[AGPLv3](LICENSE).
