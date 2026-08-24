"""photo on warehouse positions

Revision ID: 009_stock_item_image
Revises: 008_stock_revisions
Create Date: 2026-08-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "009_stock_item_image"
down_revision: Union[str, None] = "008_stock_revisions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE stock_items ADD COLUMN image_url TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE stock_items DROP COLUMN image_url")
