"""stock is_ingredient and product is_service

Revision ID: 016_stock_sellable
Revises: 015_sale_discounts
Create Date: 2026-08-26
"""

from typing import Sequence, Union

from alembic import op

revision: str = "016_stock_sellable"
down_revision: Union[str, None] = "015_sale_discounts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE stock_items ADD COLUMN is_ingredient BOOLEAN NOT NULL DEFAULT false"
    )
    op.execute(
        "ALTER TABLE products ADD COLUMN is_service BOOLEAN NOT NULL DEFAULT false"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS is_service")
    op.execute("ALTER TABLE stock_items DROP COLUMN IF EXISTS is_ingredient")
