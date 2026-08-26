"""sale discounts and can_apply_discount

Revision ID: 015_sale_discounts
Revises: 014_catalog_i18n_names
Create Date: 2026-08-26
"""

from typing import Sequence, Union

from alembic import op

revision: str = "015_sale_discounts"
down_revision: Union[str, None] = "014_catalog_i18n_names"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE discount_type AS ENUM ('percent', 'amount')")
    op.execute(
        "ALTER TABLE users ADD COLUMN can_apply_discount BOOLEAN NOT NULL DEFAULT false"
    )
    op.execute(
        """
        ALTER TABLE sales
          ADD COLUMN subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          ADD COLUMN discount_type discount_type NULL,
          ADD COLUMN discount_value NUMERIC(12, 2) NULL,
          ADD COLUMN discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
        """
    )
    op.execute(
        """
        ALTER TABLE sale_items
          ADD COLUMN discount_type discount_type NULL,
          ADD COLUMN discount_value NUMERIC(12, 2) NULL,
          ADD COLUMN discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
          ADD COLUMN line_total NUMERIC(12, 2) NOT NULL DEFAULT 0
        """
    )
    op.execute("UPDATE sales SET subtotal_amount = total_amount WHERE subtotal_amount = 0")
    op.execute(
        """
        UPDATE sale_items
        SET line_total = ROUND(price_snapshot * quantity, 2)
        WHERE line_total = 0
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE sale_items
          DROP COLUMN IF EXISTS line_total,
          DROP COLUMN IF EXISTS discount_amount,
          DROP COLUMN IF EXISTS discount_value,
          DROP COLUMN IF EXISTS discount_type
        """
    )
    op.execute(
        """
        ALTER TABLE sales
          DROP COLUMN IF EXISTS discount_amount,
          DROP COLUMN IF EXISTS discount_value,
          DROP COLUMN IF EXISTS discount_type,
          DROP COLUMN IF EXISTS subtotal_amount
        """
    )
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS can_apply_discount")
    op.execute("DROP TYPE IF EXISTS discount_type")
