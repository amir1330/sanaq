"""shop logo_url

Revision ID: 002_shop_logo
Revises: 001_initial
Create Date: 2026-08-23
"""

from typing import Sequence, Union

from alembic import op

revision: str = "002_shop_logo"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE shops ADD COLUMN logo_url TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE shops DROP COLUMN IF EXISTS logo_url")
