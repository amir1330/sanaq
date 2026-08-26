"""indexes for stock/product list search

Revision ID: 018_list_indexes
Revises: 017_sku
Create Date: 2026-08-26
"""

from typing import Sequence, Union

from alembic import op

revision: str = "018_list_indexes"
down_revision: Union[str, None] = "017_sku"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stock_items_shop_name ON stock_items (shop_id, name)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stock_items_shop_name_trgm "
        "ON stock_items USING gin (name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stock_items_shop_sku_trgm "
        "ON stock_items USING gin (sku gin_trgm_ops) WHERE sku IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_products_shop_name ON products (shop_id, name)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_products_shop_active_cat "
        "ON products (shop_id, is_active, category_id, name)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_products_shop_name_trgm "
        "ON products USING gin (name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_products_shop_sku_trgm "
        "ON products USING gin (sku gin_trgm_ops) WHERE sku IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_products_shop_sku_trgm")
    op.execute("DROP INDEX IF EXISTS ix_products_shop_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_products_shop_active_cat")
    op.execute("DROP INDEX IF EXISTS ix_products_shop_name")
    op.execute("DROP INDEX IF EXISTS ix_stock_items_shop_sku_trgm")
    op.execute("DROP INDEX IF EXISTS ix_stock_items_shop_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_stock_items_shop_name")
