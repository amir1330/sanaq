# Санақ

Касса, склад и прибыль для точки: кафе, магазин, пекарня.

Чек, смена, остатки и чистыми в одном месте — без сведения таблиц в конце месяца.

[Actions](https://github.com/amir1330/sanaq/actions)

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
- Прод (сейчас выключен): Docker + GHCR + Traefik — см. `deploy/` и `docker-compose.prod.yml`

## Разработка

Сейчас работаем **локально**. Прод на VPS остановлен; CI только гоняет тесты, без сборки образов и деплоя.

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # VITE_API_PROXY=http://127.0.0.1:8000
npm install
npm run dev
```

`npm run dev` не стартует без `VITE_API_PROXY` в `.env.local`.

### Backend

```bash
cd backend
# PostgreSQL локально (порт 5432), DATABASE_URL в .env
docker build -t sanaq-backend-test . && docker run --rm sanaq-backend-test pytest -q
```

Бэкенд-тесты в CI: `docker build ./backend && docker run … pytest`.

## Структура

```
backend/    FastAPI, миграции, тесты
frontend/   React-кабинет и касса
nginx/      статика + прокси /api
deploy/     bootstrap, provision ключа и remote.sh для Actions
```

## Деплой (на паузе)

Прод-стенд и auto-deploy отключены. Файлы в `deploy/` и `docker-compose.prod.yml` оставлены на будущее.

Раньше использовался hardened-паттерн (GHCR + SSH forced-command, пользователь `sanaq`, compose-проект `coffeeos`). Данные на VPS сохранены в volume `coffeeos_postgres_data` и `coffeeos_uploads`.

## Лицензия

[AGPLv3](LICENSE).
