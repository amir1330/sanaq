# CoffeeOS — план системы учёта для кофейни

> Рабочее название "CoffeeOS", легко поменять. Дальше — вся логика для передачи в Cursor.

## 1. Роли и что видит каждая

| Роль | Кто это | Доступ |
|---|---|---|
| `super_admin` | ты (программист) | видит все кофейни, создаёт кофейни, создаёт owner-аккаунты, глобальная статистика, вкл/выкл кофейни |
| `owner` | владелец кофейни (может быть несколько точек) | своя(и) кофейня(и): товары, склад, сотрудники (баристы), финансы, себестоимость, отчёты по прибыли |
| `barista` | бариста на точке | касса (продажа), открытие/закрытие смены, просмотр остатков склада (без цен закупки) |

Мультитенантность: одна система, много кофеен (`shops`). У owner может быть 1..N точек. Все данные жёстко привязаны к `shop_id` — это и модель безопасности (row-level filtering по shop_id в каждом запросе), и основа для будущего SaaS, если решишь продавать это другим кофейням.

## 2. Стек

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 (async) + asyncpg, Alembic (миграции), Pydantic v2, JWT (access + refresh, `python-jose`/`pyjwt`), Passlib(bcrypt)
- **DB**: PostgreSQL 16
- **Frontend**: React + Vite + TypeScript, Tailwind CSS, shadcn/ui (готовые лёгкие компоненты, не тяжёлый UI-кит), React Query (кэш запросов — важно при слабом сервере, меньше лишних запросов), Zustand (стейт, легче Redux)
- **Инфра**: Docker Compose (postgres, backend, nginx), сервер слабый → gunicorn/uvicorn с ограниченным числом воркеров (2), nginx отдаёт статику фронта и проксирует `/api`
- **CI/CD**: GitHub Actions → билд и пуш образа (или просто архив) → webhook на сервер → деплой-скрипт

## 3. Схема БД

### 3.1 Пользователи и кофейни

```sql
CREATE TYPE user_role AS ENUM ('super_admin', 'owner', 'barista');

CREATE TABLE shops (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    address       TEXT,
    timezone      TEXT NOT NULL DEFAULT 'Europe/Helsinki',
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    shop_id       BIGINT REFERENCES shops(id) ON DELETE CASCADE, -- NULL для super_admin
    role          user_role NOT NULL,
    full_name     TEXT NOT NULL,
    phone         TEXT UNIQUE,
    email         TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    pin_code      TEXT, -- короткий PIN для входа баристы на кассе (4 цифры)
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_shop ON users(shop_id);
```

Владелец нескольких точек: если нужно — `owner_shops (owner_id, shop_id)` many-to-many вместо `shop_id` на юзере. Для MVP проще: у owner тоже `shop_id` = "домашняя" точка + отдельная таблица `owner_shops`, если точек больше одной. Заложи сразу таблицу, чтобы не переделывать:

```sql
CREATE TABLE owner_shops (
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id  BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    PRIMARY KEY (owner_id, shop_id)
);
```

### 3.2 Товары, категории, склад (себестоимость)

```sql
CREATE TABLE categories (
    id       BIGSERIAL PRIMARY KEY,
    shop_id  BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name     TEXT NOT NULL
);

-- складские позиции: сырьё (молоко, зёрна, стаканы...)
CREATE TABLE stock_items (
    id            BIGSERIAL PRIMARY KEY,
    shop_id       BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    unit          TEXT NOT NULL,           -- г, мл, шт
    quantity      NUMERIC(12,3) NOT NULL DEFAULT 0,
    min_quantity  NUMERIC(12,3) NOT NULL DEFAULT 0, -- порог для алерта "заканчивается"
    cost_per_unit NUMERIC(12,4) NOT NULL DEFAULT 0, -- средняя закупочная цена за единицу
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_items_shop ON stock_items(shop_id);

-- товары, которые продаёт бариста (капучино, круассан...)
CREATE TABLE products (
    id            BIGSERIAL PRIMARY KEY,
    shop_id       BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    category_id   BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    sale_price    NUMERIC(12,2) NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    image_url     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_shop ON products(shop_id);

-- рецепт: из чего состоит товар, для авто-списания склада и расчёта себестоимости
CREATE TABLE product_ingredients (
    product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stock_item_id BIGINT NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
    quantity      NUMERIC(12,3) NOT NULL, -- сколько единицы списывается на 1 продукт
    PRIMARY KEY (product_id, stock_item_id)
);
```

Себестоимость товара = `SUM(product_ingredients.quantity * stock_items.cost_per_unit)`. Считаем на лету (view) или кэшируем снапшотом в момент продажи (см. ниже `sale_items.cost_price_snapshot`) — второе важно, потому что закупочные цены меняются, а исторические продажи должны хранить себестоимость на момент продажи, иначе отчёты "задним числом" поплывут.

### 3.3 Смены, продажи, оплата (нал/безнал)

```sql
CREATE TYPE payment_type AS ENUM ('cash', 'card');
CREATE TYPE shift_status AS ENUM ('open', 'closed');

CREATE TABLE shifts (
    id             BIGSERIAL PRIMARY KEY,
    shop_id        BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    barista_id     BIGINT NOT NULL REFERENCES users(id),
    status         shift_status NOT NULL DEFAULT 'open',
    opening_cash   NUMERIC(12,2) NOT NULL DEFAULT 0, -- касса на начало
    closing_cash   NUMERIC(12,2),                    -- касса на конец (факт, пересчитанная)
    opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at      TIMESTAMPTZ
);

CREATE INDEX idx_shifts_shop_status ON shifts(shop_id, status);

CREATE TABLE sales (
    id              BIGSERIAL PRIMARY KEY,
    shop_id         BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    shift_id        BIGINT NOT NULL REFERENCES shifts(id),
    barista_id      BIGINT NOT NULL REFERENCES users(id),
    payment_type    payment_type NOT NULL,
    total_amount    NUMERIC(12,2) NOT NULL,
    is_refunded     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- партиции по месяцам — продажи растут быстрее всего, на слабом сервере это критично
CREATE TABLE sales_2026_08 PARTITION OF sales
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
-- дальше создаётся скриптом/крон-джобой на следующий месяц заранее

CREATE TABLE sale_items (
    id                   BIGSERIAL PRIMARY KEY,
    sale_id              BIGINT NOT NULL,
    product_id           BIGINT NOT NULL REFERENCES products(id),
    quantity             INTEGER NOT NULL DEFAULT 1,
    price_snapshot       NUMERIC(12,2) NOT NULL, -- цена продажи на момент чека
    cost_price_snapshot  NUMERIC(12,2) NOT NULL  -- себестоимость на момент продажи
);

CREATE INDEX idx_sales_shop_created ON sales(shop_id, created_at);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
```

При продаже транзакционно:
1. создаётся `sale` + `sale_items`
2. по `product_ingredients` списывается `stock_items.quantity`
3. если `quantity` после списания уходит в минус/ниже `min_quantity` — отдаём флаг для алерта на фронте

### 3.4 Движения по кассе и расходы

```sql
CREATE TYPE cash_movement_type AS ENUM ('deposit', 'withdrawal'); -- внесение / изъятие

CREATE TABLE shift_cash_movements (
    id          BIGSERIAL PRIMARY KEY,
    shift_id    BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    type        cash_movement_type NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
    id          BIGSERIAL PRIMARY KEY,
    shop_id     BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    category    TEXT NOT NULL,  -- аренда, зарплата, коммуналка, закупка сырья...
    amount      NUMERIC(12,2) NOT NULL,
    comment     TEXT,
    created_by  BIGINT REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- приход/списание сырья на склад (закупка, порча, инвентаризация)
CREATE TYPE stock_movement_type AS ENUM ('income', 'writeoff', 'correction');

CREATE TABLE stock_movements (
    id            BIGSERIAL PRIMARY KEY,
    shop_id       BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    stock_item_id BIGINT NOT NULL REFERENCES stock_items(id),
    type          stock_movement_type NOT NULL,
    quantity      NUMERIC(12,3) NOT NULL,
    price_total   NUMERIC(12,2), -- для income, чтобы пересчитать cost_per_unit
    comment       TEXT,
    created_by    BIGINT REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Закупка сырья (`income`) — по `price_total / quantity` пересчитывается `cost_per_unit` в `stock_items` (средневзвешенная себестоимость, moving average).

### 3.5 Отчёты — materialized view под дашборд owner

Считать прибыль на лету по всем продажам на слабом сервере — плохая идея при росте данных. Делаем `daily_shop_summary`, обновляем раз в час/по крону:

```sql
CREATE MATERIALIZED VIEW daily_shop_summary AS
SELECT
    shop_id,
    date_trunc('day', created_at) AS day,
    SUM(total_amount) FILTER (WHERE payment_type = 'cash') AS cash_revenue,
    SUM(total_amount) FILTER (WHERE payment_type = 'card') AS card_revenue,
    SUM(total_amount) AS revenue,
    COUNT(*) AS sales_count
FROM sales
WHERE NOT is_refunded
GROUP BY shop_id, date_trunc('day', created_at);

CREATE UNIQUE INDEX ON daily_shop_summary (shop_id, day);
```

Себестоимость и прибыль за период — джойн `sale_items.cost_price_snapshot` отдельным агрегатом или второй materialized view `daily_shop_profit`.

### 3.6 Индексы и оптимизации под слабый сервер

- Все "горячие" запросы фильтруются по `shop_id` — везде составные индексы `(shop_id, created_at)`
- `sales` партиционирована по месяцу — старые месяцы можно даже выгружать в архив/сжимать
- `materialized view` вместо `SUM()` по всей таблице на каждый заход в дашборд
- Пул соединений — `asyncpg` + PgBouncer (транзакционный режим), лимит 20-30 соединений даже при 100 конкурентных пользователей
- `EXPLAIN ANALYZE` на отчётные запросы перед продом, `pg_stat_statements` включить для мониторинга медленных запросов
- Регулярный `VACUUM`/`autovacuum` тюнинг — при слабом сервере лучше уменьшить `autovacuum_vacuum_cost_delay`

## 4. API (REST, `/api/v1`, JWT в заголовке)

### Auth
- `POST /auth/login` — email/phone + пароль → access+refresh
- `POST /auth/login-pin` — barista: `shop_id` + `pin_code` (быстрый вход на кассе на общем терминале)
- `POST /auth/refresh`

### Super Admin
- `GET/POST /admin/shops` — список/создание кофеен
- `PATCH /admin/shops/{id}` — вкл/выкл, редактирование
- `POST /admin/shops/{id}/owners` — создать owner-аккаунт для кофейни
- `GET /admin/stats` — сводная статистика по всем кофейням

### Owner
- `GET/POST/PATCH/DELETE /shops/{shop_id}/products`
- `GET/POST/PATCH/DELETE /shops/{shop_id}/categories`
- `GET/POST/PATCH /shops/{shop_id}/stock-items`
- `POST /shops/{shop_id}/stock-items/{id}/movements` — приход/списание
- `POST /shops/{shop_id}/products/{id}/ingredients` — привязать рецепт
- `GET/POST /shops/{shop_id}/staff` — управление баристами (создать, PIN, деактивировать)
- `GET /shops/{shop_id}/reports/summary?from=&to=` — выручка, нал/безнал, себестоимость, прибыль
- `GET /shops/{shop_id}/reports/top-products`
- `GET/POST /shops/{shop_id}/expenses`
- `GET /shops/{shop_id}/shifts` — история смен с итогами по каждой

### Barista
- `GET /shops/{shop_id}/products` — меню для кассы (только активные)
- `POST /shifts/open`, `POST /shifts/{id}/close` — с указанием фактической суммы в кассе
- `POST /sales` — создать чек: `{items: [{product_id, quantity}], payment_type}`
- `POST /sales/{id}/refund`
- `POST /shifts/{id}/cash-movements` — внесение/изъятие
- `GET /shifts/{id}` — текущая смена: сколько нал/безнал, сколько продаж

## 5. Frontend — структура по ролям

Один SPA, роутинг по роли после логина (`/admin/*`, `/owner/*`, `/pos/*`).

**`/pos` (бариста, кассовый режим, планшет/тач)**
- Экран входа по PIN
- Сетка товаров по категориям, тап → в чек
- Итог чека, выбор оплаты (нал/безнал), "Пробить"
- Кнопка открытия/закрытия смены с вводом суммы в кассе
- Внесение/изъятие наличности

**`/owner`**
- Дашборд: выручка сегодня/неделя/месяц, нал vs безнал (диаграмма), прибыль, топ товаров
- Товары: список, редактирование цены, привязка рецепта к складским позициям
- Склад: остатки, алерты "заканчивается", приход/списание
- Сотрудники: список баристов, PIN-коды, активность по сменам
- Расходы: список + добавление
- Смены: история, кто когда открывал/закрывал, расхождения кассы

**`/admin` (super_admin)**
- Список кофеен: создать/выключить
- Создание owner-аккаунта под кофейню
- Общая статистика по всем точкам (для тебя как продукт-оунера системы)

## 6. Деплой / CI-CD под слабый сервер

1. Репозиторий: `backend/`, `frontend/`, `docker-compose.yml`, `deploy/`
2. `docker-compose.yml`: `postgres`, `backend` (uvicorn, 2 воркера), `nginx` (отдаёт собранный фронт + проксирует `/api` на backend)
3. GitHub Actions (`.github/workflows/deploy.yml`):
   - на push в `main`: линт/тесты → сборка Docker-образов → пуш в GitHub Container Registry (бесплатно, не грузит сервер сборкой)
   - последний шаг: `curl` на вебхук-эндпоинт сервера с секретным токеном/HMAC-подписью
4. На сервере — маленький receiver (FastAPI-эндпоинт или `webhook` (adnanh/webhook) демон), который по валидному запросу делает:
   ```bash
   docker compose pull && docker compose up -d
   ```
   Так сборка происходит на GitHub, сервер только скачивает готовые образы — экономит CPU/RAM слабого сервера.
5. Миграции (`alembic upgrade head`) — отдельным шагом в деплой-скрипте перед `up -d`, чтобы не гонять их из контейнера каждый раз.

Если покажешь пример из своих готовых проектов — подгоню именно под твой существующий пайплайн вместо этой схемы с нуля.

## 7. Порядок разработки (для Cursor)

1. Backend: модели SQLAlchemy + Alembic миграция по схеме выше
2. Auth (JWT + PIN-логин) + мидлварь проверки роли и `shop_id`
3. CRUD: shops → products/categories → stock-items → product_ingredients
4. Смены + продажи (транзакция продажи со списанием склада) — это ядро системы
5. Отчёты (materialized views + эндпоинты)
6. Frontend: сначала `/pos` (самое used-каждый-день), потом `/owner`, потом `/admin`
7. Docker Compose + CI/CD в последнюю очередь, когда MVP работает локально
