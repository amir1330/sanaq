"""optional product barcode for scanner

Revision ID: 019_product_barcode
Revises: 018_list_indexes
Create Date: 2026-08-27
"""

from typing import Sequence, Union

from alembic import op

revision: str = "019_product_barcode"
down_revision: Union[str, None] = "018_list_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE products ADD COLUMN barcode TEXT")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_products_shop_barcode
        ON products (shop_id, barcode)
        WHERE barcode IS NOT NULL AND barcode <> ''
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_products_shop_barcode
        ON products (shop_id, barcode)
        WHERE barcode IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_products_shop_barcode")
    op.execute("DROP INDEX IF EXISTS uq_products_shop_barcode")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS barcode")
