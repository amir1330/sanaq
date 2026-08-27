"""product variants and sale_items.variant_*

Revision ID: 020_product_variants
Revises: 019_product_barcode
Create Date: 2026-08-27
"""

from typing import Sequence, Union

from alembic import op

revision: str = "020_product_variants"
down_revision: Union[str, None] = "019_product_barcode"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS product_variants (
            id BIGSERIAL PRIMARY KEY,
            product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            name_kk TEXT,
            name_en TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            sale_price NUMERIC(12, 2) NOT NULL,
            sku TEXT,
            barcode TEXT,
            is_default BOOLEAN NOT NULL DEFAULT false,
            is_active BOOLEAN NOT NULL DEFAULT true
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_product_variants_product_id ON product_variants (product_id)"
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_product_sku
        ON product_variants (product_id, sku)
        WHERE sku IS NOT NULL AND sku <> ''
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_product_variants_barcode
        ON product_variants (barcode)
        WHERE barcode IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS product_variant_ingredients (
            variant_id BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
            stock_item_id BIGINT NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
            quantity NUMERIC(12, 3) NOT NULL,
            PRIMARY KEY (variant_id, stock_item_id)
        )
        """
    )
    op.execute("ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS variant_id BIGINT")
    op.execute("ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS variant_name_snapshot TEXT")
    op.execute(
        """
        DO $$ BEGIN
            ALTER TABLE sale_items
            ADD CONSTRAINT fk_sale_items_variant_id
            FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS fk_sale_items_variant_id")
    op.execute("ALTER TABLE sale_items DROP COLUMN IF EXISTS variant_name_snapshot")
    op.execute("ALTER TABLE sale_items DROP COLUMN IF EXISTS variant_id")
    op.execute("DROP TABLE IF EXISTS product_variant_ingredients")
    op.execute("DROP INDEX IF EXISTS ix_product_variants_barcode")
    op.execute("DROP INDEX IF EXISTS uq_product_variants_product_sku")
    op.execute("DROP INDEX IF EXISTS ix_product_variants_product_id")
    op.execute("DROP TABLE IF EXISTS product_variants")
