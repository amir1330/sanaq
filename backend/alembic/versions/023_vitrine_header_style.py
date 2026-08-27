"""vitrine header_style; drop vitrine_items.variant_id

Revision ID: 023_vitrine_header_style
Revises: 022_vitrine_layout
Create Date: 2026-08-28
"""

from typing import Sequence, Union

from alembic import op

revision: str = "023_vitrine_header_style"
down_revision: Union[str, None] = "022_vitrine_layout"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE vitrine_columns ADD COLUMN IF NOT EXISTS header_style TEXT NOT NULL DEFAULT 'ornament'"
    )
    op.execute("ALTER TABLE vitrine_items DROP COLUMN IF EXISTS variant_id")


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE vitrine_items
        ADD COLUMN IF NOT EXISTS variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL
        """
    )
    op.execute("ALTER TABLE vitrine_columns DROP COLUMN IF EXISTS header_style")
