"""initial coffeeos schema

Revision ID: 001_initial
Revises:
Create Date: 2026-08-23
"""

from typing import Sequence, Union

from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


STATEMENTS = [
    "CREATE TYPE user_role AS ENUM ('super_admin', 'owner', 'barista')",
    "CREATE TYPE payment_type AS ENUM ('cash', 'card')",
    "CREATE TYPE shift_status AS ENUM ('open', 'closed')",
    "CREATE TYPE cash_movement_type AS ENUM ('deposit', 'withdrawal')",
    "CREATE TYPE stock_movement_type AS ENUM ('income', 'writeoff', 'correction')",
    """
    CREATE TABLE shops (
        id            BIGSERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        address       TEXT,
        timezone      TEXT NOT NULL DEFAULT 'Europe/Helsinki',
        is_active     BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE users (
        id            BIGSERIAL PRIMARY KEY,
        shop_id       BIGINT REFERENCES shops(id) ON DELETE CASCADE,
        role          user_role NOT NULL,
        full_name     TEXT NOT NULL,
        phone         TEXT UNIQUE,
        email         TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        pin_code      TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX idx_users_shop ON users(shop_id)",
    """
    CREATE TABLE owner_shops (
        owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shop_id  BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        PRIMARY KEY (owner_id, shop_id)
    )
    """,
    """
    CREATE TABLE categories (
        id       BIGSERIAL PRIMARY KEY,
        shop_id  BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name     TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE stock_items (
        id            BIGSERIAL PRIMARY KEY,
        shop_id       BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        unit          TEXT NOT NULL,
        quantity      NUMERIC(12,3) NOT NULL DEFAULT 0,
        min_quantity  NUMERIC(12,3) NOT NULL DEFAULT 0,
        cost_per_unit NUMERIC(12,4) NOT NULL DEFAULT 0,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX idx_stock_items_shop ON stock_items(shop_id)",
    """
    CREATE TABLE products (
        id            BIGSERIAL PRIMARY KEY,
        shop_id       BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        category_id   BIGINT REFERENCES categories(id) ON DELETE SET NULL,
        name          TEXT NOT NULL,
        sale_price    NUMERIC(12,2) NOT NULL,
        is_active     BOOLEAN NOT NULL DEFAULT true,
        image_url     TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX idx_products_shop ON products(shop_id)",
    """
    CREATE TABLE product_ingredients (
        product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        stock_item_id BIGINT NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
        quantity      NUMERIC(12,3) NOT NULL,
        PRIMARY KEY (product_id, stock_item_id)
    )
    """,
    """
    CREATE TABLE shifts (
        id             BIGSERIAL PRIMARY KEY,
        shop_id        BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        barista_id     BIGINT NOT NULL REFERENCES users(id),
        status         shift_status NOT NULL DEFAULT 'open',
        opening_cash   NUMERIC(12,2) NOT NULL DEFAULT 0,
        closing_cash   NUMERIC(12,2),
        opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        closed_at      TIMESTAMPTZ
    )
    """,
    "CREATE INDEX idx_shifts_shop_status ON shifts(shop_id, status)",
    """
    CREATE TABLE sales (
        id              BIGSERIAL NOT NULL,
        shop_id         BIGINT NOT NULL,
        shift_id        BIGINT NOT NULL REFERENCES shifts(id),
        barista_id      BIGINT NOT NULL REFERENCES users(id),
        payment_type    payment_type NOT NULL,
        total_amount    NUMERIC(12,2) NOT NULL,
        is_refunded     BOOLEAN NOT NULL DEFAULT false,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at)
    """,
    """
    CREATE TABLE sale_items (
        id                   BIGSERIAL PRIMARY KEY,
        sale_id              BIGINT NOT NULL,
        product_id           BIGINT NOT NULL REFERENCES products(id),
        quantity             INTEGER NOT NULL DEFAULT 1,
        price_snapshot       NUMERIC(12,2) NOT NULL,
        cost_price_snapshot  NUMERIC(12,2) NOT NULL
    )
    """,
    "CREATE INDEX idx_sale_items_sale ON sale_items(sale_id)",
    """
    CREATE TABLE shift_cash_movements (
        id          BIGSERIAL PRIMARY KEY,
        shift_id    BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        type        cash_movement_type NOT NULL,
        amount      NUMERIC(12,2) NOT NULL,
        comment     TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE expenses (
        id          BIGSERIAL PRIMARY KEY,
        shop_id     BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        category    TEXT NOT NULL,
        amount      NUMERIC(12,2) NOT NULL,
        comment     TEXT,
        created_by  BIGINT REFERENCES users(id),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX idx_expenses_shop_created ON expenses(shop_id, created_at)",
    """
    CREATE TABLE stock_movements (
        id            BIGSERIAL PRIMARY KEY,
        shop_id       BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        stock_item_id BIGINT NOT NULL REFERENCES stock_items(id),
        type          stock_movement_type NOT NULL,
        quantity      NUMERIC(12,3) NOT NULL,
        price_total   NUMERIC(12,2),
        comment       TEXT,
        created_by    BIGINT REFERENCES users(id),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX idx_stock_movements_shop_created ON stock_movements(shop_id, created_at)",
    """
    CREATE OR REPLACE FUNCTION create_sales_partition(month_start DATE)
    RETURNS VOID AS $$
    DECLARE
        month_end DATE := (month_start + INTERVAL '1 month')::DATE;
        part_name TEXT := format('sales_%s', to_char(month_start, 'YYYY_MM'));
    BEGIN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF sales FOR VALUES FROM (%L) TO (%L)',
            part_name, month_start, month_end
        );
    END;
    $$ LANGUAGE plpgsql
    """,
    """
    SELECT create_sales_partition(d::DATE)
    FROM generate_series('2026-01-01'::DATE, '2028-12-01'::DATE, INTERVAL '1 month') AS d
    """,
    "CREATE INDEX idx_sales_shop_created ON sales(shop_id, created_at)",
    """
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
    GROUP BY shop_id, date_trunc('day', created_at)
    """,
    "CREATE UNIQUE INDEX ON daily_shop_summary (shop_id, day)",
    """
    CREATE MATERIALIZED VIEW daily_shop_profit AS
    SELECT
        s.shop_id,
        date_trunc('day', s.created_at) AS day,
        SUM(si.price_snapshot * si.quantity) AS revenue,
        SUM(si.cost_price_snapshot * si.quantity) AS cost,
        SUM(si.price_snapshot * si.quantity) - SUM(si.cost_price_snapshot * si.quantity) AS profit
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    WHERE NOT s.is_refunded
    GROUP BY s.shop_id, date_trunc('day', s.created_at)
    """,
    "CREATE UNIQUE INDEX ON daily_shop_profit (shop_id, day)",
]


def upgrade() -> None:
    for statement in STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in [
        "DROP MATERIALIZED VIEW IF EXISTS daily_shop_profit",
        "DROP MATERIALIZED VIEW IF EXISTS daily_shop_summary",
        "DROP TABLE IF EXISTS stock_movements",
        "DROP TABLE IF EXISTS expenses",
        "DROP TABLE IF EXISTS shift_cash_movements",
        "DROP TABLE IF EXISTS sale_items",
        "DROP TABLE IF EXISTS sales",
        "DROP TABLE IF EXISTS shifts",
        "DROP TABLE IF EXISTS product_ingredients",
        "DROP TABLE IF EXISTS products",
        "DROP TABLE IF EXISTS stock_items",
        "DROP TABLE IF EXISTS categories",
        "DROP TABLE IF EXISTS owner_shops",
        "DROP TABLE IF EXISTS users",
        "DROP TABLE IF EXISTS shops",
        "DROP FUNCTION IF EXISTS create_sales_partition(DATE)",
        "DROP TYPE IF EXISTS stock_movement_type",
        "DROP TYPE IF EXISTS cash_movement_type",
        "DROP TYPE IF EXISTS shift_status",
        "DROP TYPE IF EXISTS payment_type",
        "DROP TYPE IF EXISTS user_role",
    ]:
        op.execute(statement)
