"""menu layout, category/product sort_order, shop business_type

Revision ID: 021_menu_layout
Revises: 020_product_variants
Create Date: 2026-08-27
"""

from typing import Sequence, Union

from alembic import op

revision: str = "021_menu_layout"
down_revision: Union[str, None] = "020_product_variants"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT")
    op.execute("ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE shops ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'cafe'")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS menu_layouts (
            shop_id BIGINT PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
            columns INTEGER NOT NULL DEFAULT 3,
            show_dividers BOOLEAN NOT NULL DEFAULT true,
            card_style TEXT NOT NULL DEFAULT 'photo',
            config_json JSONB NOT NULL DEFAULT '{}'::jsonb
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS menu_layouts")
    op.execute("ALTER TABLE shops DROP COLUMN IF EXISTS business_type")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS sort_order")
    op.execute("ALTER TABLE categories DROP COLUMN IF EXISTS icon")
    op.execute("ALTER TABLE categories DROP COLUMN IF EXISTS color")
    op.execute("ALTER TABLE categories DROP COLUMN IF EXISTS sort_order")
