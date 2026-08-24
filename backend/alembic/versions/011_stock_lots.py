"""FIFO lots for warehouse cost

Revision ID: 011_stock_lots
Revises: 010_uploads
Create Date: 2026-08-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "011_stock_lots"
down_revision: Union[str, None] = "010_uploads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE stock_lots (
            id                  BIGSERIAL PRIMARY KEY,
            shop_id             BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            stock_item_id       BIGINT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
            quantity_remaining  NUMERIC(14, 3) NOT NULL,
            cost_per_base_unit  NUMERIC(12, 4) NOT NULL DEFAULT 0,
            received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
            source_movement_id  BIGINT REFERENCES stock_movements(id) ON DELETE SET NULL
        )
        """
    )
    op.execute("CREATE INDEX idx_stock_lots_item ON stock_lots (stock_item_id, received_at, id)")
    op.execute("CREATE INDEX idx_stock_lots_shop ON stock_lots (shop_id)")
    op.execute(
        """
        INSERT INTO stock_lots (shop_id, stock_item_id, quantity_remaining, cost_per_base_unit, received_at)
        SELECT shop_id, id, quantity, cost_per_base_unit, updated_at
        FROM stock_items
        WHERE quantity > 0
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS stock_lots")
