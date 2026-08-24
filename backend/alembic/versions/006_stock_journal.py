"""stock journal: sale/refund types, name snapshots, change logs

Revision ID: 006_stock_journal
Revises: 005_stock_units
Create Date: 2026-08-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "006_stock_journal"
down_revision: Union[str, None] = "005_stock_units"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'sale'")
    op.execute("ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'refund'")
    op.execute("ALTER TABLE stock_movements ADD COLUMN stock_item_name TEXT")
    op.execute("ALTER TABLE stock_movements ADD COLUMN base_unit TEXT")
    op.execute("ALTER TABLE stock_movements ADD COLUMN purchase_unit TEXT")
    op.execute(
        "UPDATE stock_movements m SET stock_item_name = i.name, "
        "base_unit = i.base_unit, purchase_unit = i.purchase_unit "
        "FROM stock_items i WHERE i.id = m.stock_item_id"
    )
    op.execute("ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_stock_item_id_fkey")
    op.execute("ALTER TABLE stock_movements ALTER COLUMN stock_item_id DROP NOT NULL")
    op.execute(
        "ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_stock_item_id_fkey "
        "FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE SET NULL"
    )
    op.execute("CREATE TYPE stock_log_action AS ENUM ('created', 'updated', 'deleted')")
    op.execute(
        "CREATE TABLE stock_logs ("
        "id BIGSERIAL PRIMARY KEY, "
        "shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE, "
        "stock_item_id BIGINT REFERENCES stock_items(id) ON DELETE SET NULL, "
        "stock_item_name TEXT NOT NULL, "
        "action stock_log_action NOT NULL, "
        "detail TEXT, "
        "created_by BIGINT REFERENCES users(id), "
        "created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        ")"
    )
    op.execute("CREATE INDEX idx_stock_logs_shop_created ON stock_logs(shop_id, created_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_stock_logs_shop_created")
    op.execute("DROP TABLE IF EXISTS stock_logs")
    op.execute("DROP TYPE IF EXISTS stock_log_action")
    op.execute("ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_stock_item_id_fkey")
    op.execute("ALTER TABLE stock_movements ALTER COLUMN stock_item_id SET NOT NULL")
    op.execute(
        "ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_stock_item_id_fkey "
        "FOREIGN KEY (stock_item_id) REFERENCES stock_items(id)"
    )
    op.execute("ALTER TABLE stock_movements DROP COLUMN IF EXISTS purchase_unit")
    op.execute("ALTER TABLE stock_movements DROP COLUMN IF EXISTS base_unit")
    op.execute("ALTER TABLE stock_movements DROP COLUMN IF EXISTS stock_item_name")
