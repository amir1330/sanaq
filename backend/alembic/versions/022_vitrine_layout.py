"""vitrine columns/items; drop menu_layouts

Revision ID: 022_vitrine_layout
Revises: 021_menu_layout
Create Date: 2026-08-27
"""

from typing import Sequence, Union

from alembic import op

revision: str = "022_vitrine_layout"
down_revision: Union[str, None] = "021_menu_layout"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS menu_layouts")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS vitrine_columns (
            id BIGSERIAL PRIMARY KEY,
            shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            title_kk TEXT,
            title_en TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_vitrine_columns_shop_id ON vitrine_columns (shop_id)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS vitrine_items (
            id BIGSERIAL PRIMARY KEY,
            column_id BIGINT NOT NULL REFERENCES vitrine_columns(id) ON DELETE CASCADE,
            product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_vitrine_items_column_id ON vitrine_items (column_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS vitrine_items")
    op.execute("DROP TABLE IF EXISTS vitrine_columns")
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
