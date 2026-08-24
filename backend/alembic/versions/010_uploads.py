"""uploads table; logos and photos as FK

Revision ID: 010_uploads
Revises: 009_stock_item_image
Create Date: 2026-08-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "010_uploads"
down_revision: Union[str, None] = "009_stock_item_image"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE uploads (
            id            BIGSERIAL PRIMARY KEY,
            shop_id       BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            kind          TEXT NOT NULL,
            original_name TEXT NOT NULL,
            size_bytes    BIGINT NOT NULL,
            content_type  TEXT NOT NULL,
            extension     TEXT NOT NULL,
            file_path     TEXT NOT NULL,
            uploader_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_uploads_shop ON uploads (shop_id, kind)")
    op.execute("ALTER TABLE shops ADD COLUMN logo_upload_id BIGINT")
    op.execute("ALTER TABLE products ADD COLUMN image_upload_id BIGINT")
    op.execute("ALTER TABLE stock_items ADD COLUMN image_upload_id BIGINT")
    op.execute(
        """
        DO $$
        DECLARE r RECORD;
        uid BIGINT;
        BEGIN
          FOR r IN SELECT id, logo_url FROM shops WHERE logo_url IS NOT NULL AND logo_url <> '' LOOP
            INSERT INTO uploads (shop_id, kind, original_name, size_bytes, content_type, extension, file_path)
            VALUES (
              r.id,
              'logo',
              coalesce(nullif(split_part(r.logo_url, '/', -1), ''), 'logo'),
              0,
              CASE
                WHEN r.logo_url ILIKE '%.svg' THEN 'image/svg+xml'
                WHEN r.logo_url ILIKE '%.png' THEN 'image/png'
                WHEN r.logo_url ILIKE '%.webp' THEN 'image/webp'
                ELSE 'image/jpeg'
              END,
              CASE
                WHEN r.logo_url ILIKE '%.svg' THEN '.svg'
                WHEN r.logo_url ILIKE '%.png' THEN '.png'
                WHEN r.logo_url ILIKE '%.webp' THEN '.webp'
                WHEN r.logo_url ILIKE '%.jpg' THEN '.jpg'
                WHEN r.logo_url ILIKE '%.jpeg' THEN '.jpg'
                ELSE ''
              END,
              r.logo_url
            )
            RETURNING id INTO uid;
            UPDATE shops SET logo_upload_id = uid WHERE id = r.id;
          END LOOP;

          FOR r IN SELECT id, shop_id, image_url FROM products WHERE image_url IS NOT NULL AND image_url <> '' LOOP
            INSERT INTO uploads (shop_id, kind, original_name, size_bytes, content_type, extension, file_path)
            VALUES (
              r.shop_id,
              'product',
              coalesce(nullif(split_part(r.image_url, '/', -1), ''), 'photo'),
              0,
              CASE
                WHEN r.image_url ILIKE '%.png' THEN 'image/png'
                WHEN r.image_url ILIKE '%.webp' THEN 'image/webp'
                ELSE 'image/jpeg'
              END,
              CASE
                WHEN r.image_url ILIKE '%.png' THEN '.png'
                WHEN r.image_url ILIKE '%.webp' THEN '.webp'
                WHEN r.image_url ILIKE '%.jpg' THEN '.jpg'
                WHEN r.image_url ILIKE '%.jpeg' THEN '.jpg'
                ELSE ''
              END,
              r.image_url
            )
            RETURNING id INTO uid;
            UPDATE products SET image_upload_id = uid WHERE id = r.id;
          END LOOP;

          FOR r IN SELECT id, shop_id, image_url FROM stock_items WHERE image_url IS NOT NULL AND image_url <> '' LOOP
            INSERT INTO uploads (shop_id, kind, original_name, size_bytes, content_type, extension, file_path)
            VALUES (
              r.shop_id,
              'stock',
              coalesce(nullif(split_part(r.image_url, '/', -1), ''), 'photo'),
              0,
              CASE
                WHEN r.image_url ILIKE '%.png' THEN 'image/png'
                WHEN r.image_url ILIKE '%.webp' THEN 'image/webp'
                ELSE 'image/jpeg'
              END,
              CASE
                WHEN r.image_url ILIKE '%.png' THEN '.png'
                WHEN r.image_url ILIKE '%.webp' THEN '.webp'
                WHEN r.image_url ILIKE '%.jpg' THEN '.jpg'
                WHEN r.image_url ILIKE '%.jpeg' THEN '.jpg'
                ELSE ''
              END,
              r.image_url
            )
            RETURNING id INTO uid;
            UPDATE stock_items SET image_upload_id = uid WHERE id = r.id;
          END LOOP;
        END $$;
        """
    )
    op.execute(
        """
        ALTER TABLE shops
          ADD CONSTRAINT fk_shops_logo_upload_id
          FOREIGN KEY (logo_upload_id) REFERENCES uploads(id) ON DELETE SET NULL
        """
    )
    op.execute(
        """
        ALTER TABLE products
          ADD CONSTRAINT fk_products_image_upload_id
          FOREIGN KEY (image_upload_id) REFERENCES uploads(id) ON DELETE SET NULL
        """
    )
    op.execute(
        """
        ALTER TABLE stock_items
          ADD CONSTRAINT fk_stock_items_image_upload_id
          FOREIGN KEY (image_upload_id) REFERENCES uploads(id) ON DELETE SET NULL
        """
    )
    op.execute("ALTER TABLE shops DROP COLUMN logo_url")
    op.execute("ALTER TABLE products DROP COLUMN image_url")
    op.execute("ALTER TABLE stock_items DROP COLUMN image_url")


def downgrade() -> None:
    op.execute("ALTER TABLE shops ADD COLUMN logo_url TEXT")
    op.execute("ALTER TABLE products ADD COLUMN image_url TEXT")
    op.execute("ALTER TABLE stock_items ADD COLUMN image_url TEXT")
    op.execute(
        """
        UPDATE shops s SET logo_url = u.file_path
        FROM uploads u WHERE s.logo_upload_id = u.id
        """
    )
    op.execute(
        """
        UPDATE products p SET image_url = u.file_path
        FROM uploads u WHERE p.image_upload_id = u.id
        """
    )
    op.execute(
        """
        UPDATE stock_items i SET image_url = u.file_path
        FROM uploads u WHERE i.image_upload_id = u.id
        """
    )
    op.execute("ALTER TABLE shops DROP CONSTRAINT IF EXISTS fk_shops_logo_upload_id")
    op.execute("ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_image_upload_id")
    op.execute("ALTER TABLE stock_items DROP CONSTRAINT IF EXISTS fk_stock_items_image_upload_id")
    op.execute("ALTER TABLE shops DROP COLUMN logo_upload_id")
    op.execute("ALTER TABLE products DROP COLUMN image_upload_id")
    op.execute("ALTER TABLE stock_items DROP COLUMN image_upload_id")
    op.execute("DROP TABLE IF EXISTS uploads")
