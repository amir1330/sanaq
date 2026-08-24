"""regrade and branch transfer movement types

Revision ID: 012_stock_regrade_transfer
Revises: 011_stock_lots
Create Date: 2026-08-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "012_stock_regrade_transfer"
down_revision: Union[str, None] = "011_stock_lots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'transfer_out'")
    op.execute("ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'transfer_in'")
    op.execute("ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'regrade_out'")
    op.execute("ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'regrade_in'")


def downgrade() -> None:
    pass
