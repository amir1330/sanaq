"""base vs purchase stock units

Revision ID: 005_stock_units
Revises: 004_staff_permissions
Create Date: 2026-08-23
"""

from typing import Sequence, Union

from alembic import op

revision: str = "005_stock_units"
down_revision: Union[str, None] = "004_staff_permissions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE stock_items ADD COLUMN base_unit TEXT")
    op.execute("UPDATE stock_items SET base_unit = unit")
    op.execute("ALTER TABLE stock_items ALTER COLUMN base_unit SET NOT NULL")
    op.execute("ALTER TABLE stock_items ADD COLUMN purchase_unit TEXT")
    op.execute("UPDATE stock_items SET purchase_unit = unit")
    op.execute("ALTER TABLE stock_items ALTER COLUMN purchase_unit SET NOT NULL")
    op.execute(
        "ALTER TABLE stock_items ADD COLUMN purchase_to_base NUMERIC(12,3) NOT NULL DEFAULT 1"
    )
    op.execute("ALTER TABLE stock_items ADD COLUMN cost_per_base_unit NUMERIC(12,4)")
    op.execute("UPDATE stock_items SET cost_per_base_unit = cost_per_unit")
    op.execute("ALTER TABLE stock_items ALTER COLUMN cost_per_base_unit SET NOT NULL")
    op.execute("ALTER TABLE stock_items ALTER COLUMN cost_per_base_unit SET DEFAULT 0")
    op.execute("ALTER TABLE stock_items ALTER COLUMN quantity TYPE NUMERIC(14,3)")
    op.execute("ALTER TABLE stock_items ALTER COLUMN min_quantity TYPE NUMERIC(14,3)")
    op.execute("ALTER TABLE stock_items DROP COLUMN unit")
    op.execute("ALTER TABLE stock_items DROP COLUMN cost_per_unit")

    op.execute("ALTER TABLE stock_movements ADD COLUMN quantity_base NUMERIC(14,3)")
    op.execute("UPDATE stock_movements SET quantity_base = quantity")
    op.execute("ALTER TABLE stock_movements ALTER COLUMN quantity_base SET NOT NULL")
    op.execute("ALTER TABLE stock_movements ADD COLUMN quantity_purchase NUMERIC(12,3)")
    op.execute(
        "UPDATE stock_movements SET quantity_purchase = quantity WHERE type = 'income'"
    )
    op.execute("ALTER TABLE stock_movements DROP COLUMN quantity")


def downgrade() -> None:
    op.execute("ALTER TABLE stock_movements ADD COLUMN quantity NUMERIC(12,3)")
    op.execute("UPDATE stock_movements SET quantity = quantity_base")
    op.execute("ALTER TABLE stock_movements ALTER COLUMN quantity SET NOT NULL")
    op.execute("ALTER TABLE stock_movements DROP COLUMN quantity_purchase")
    op.execute("ALTER TABLE stock_movements DROP COLUMN quantity_base")

    op.execute("ALTER TABLE stock_items ADD COLUMN unit TEXT")
    op.execute("UPDATE stock_items SET unit = base_unit")
    op.execute("ALTER TABLE stock_items ALTER COLUMN unit SET NOT NULL")
    op.execute("ALTER TABLE stock_items ADD COLUMN cost_per_unit NUMERIC(12,4)")
    op.execute("UPDATE stock_items SET cost_per_unit = cost_per_base_unit")
    op.execute("ALTER TABLE stock_items ALTER COLUMN cost_per_unit SET NOT NULL")
    op.execute("ALTER TABLE stock_items ALTER COLUMN cost_per_unit SET DEFAULT 0")
    op.execute("ALTER TABLE stock_items DROP COLUMN base_unit")
    op.execute("ALTER TABLE stock_items DROP COLUMN purchase_unit")
    op.execute("ALTER TABLE stock_items DROP COLUMN purchase_to_base")
    op.execute("ALTER TABLE stock_items DROP COLUMN cost_per_base_unit")
