"""stock and product sku (article)

Revision ID: 017_sku
Revises: 016_stock_sellable
Create Date: 2026-08-26
"""

from typing import Sequence, Union

from alembic import op

revision: str = "017_sku"
down_revision: Union[str, None] = "016_stock_sellable"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE stock_items ADD COLUMN sku TEXT")
    op.execute("ALTER TABLE products ADD COLUMN sku TEXT")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_items_shop_sku
        ON stock_items (shop_id, sku)
        WHERE sku IS NOT NULL AND sku <> ''
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_products_shop_sku
        ON products (shop_id, sku)
        WHERE sku IS NOT NULL AND sku <> ''
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_products_shop_sku")
    op.execute("DROP INDEX IF EXISTS uq_stock_items_shop_sku")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS sku")
    op.execute("ALTER TABLE stock_items DROP COLUMN IF EXISTS sku")
