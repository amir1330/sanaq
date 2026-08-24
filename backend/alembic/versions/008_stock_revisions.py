"""stock revisions: count sheets and posted corrections

Revision ID: 008_stock_revisions
Revises: 007_webkassa
Create Date: 2026-08-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "008_stock_revisions"
down_revision: Union[str, None] = "007_webkassa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE stock_revision_status AS ENUM ('draft', 'posted', 'cancelled')")
    op.execute(
        """
        CREATE TABLE stock_revisions (
            id BIGSERIAL PRIMARY KEY,
            shop_id BIGINT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            status stock_revision_status NOT NULL DEFAULT 'draft',
            comment TEXT,
            created_by BIGINT REFERENCES users(id),
            posted_by BIGINT REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            posted_at TIMESTAMPTZ,
            cancelled_at TIMESTAMPTZ
        )
        """
    )
    op.execute("CREATE INDEX idx_stock_revisions_shop ON stock_revisions (shop_id, created_at DESC)")
    op.execute(
        """
        CREATE UNIQUE INDEX uq_stock_revisions_one_draft
        ON stock_revisions (shop_id)
        WHERE status = 'draft'
        """
    )
    op.execute(
        """
        CREATE TABLE stock_revision_lines (
            id BIGSERIAL PRIMARY KEY,
            revision_id BIGINT NOT NULL REFERENCES stock_revisions(id) ON DELETE CASCADE,
            stock_item_id BIGINT REFERENCES stock_items(id) ON DELETE SET NULL,
            stock_item_name TEXT NOT NULL,
            base_unit TEXT NOT NULL,
            expected_quantity NUMERIC(14,3) NOT NULL,
            counted_quantity NUMERIC(14,3),
            difference_quantity NUMERIC(14,3),
            cost_per_base_unit NUMERIC(12,4) NOT NULL DEFAULT 0,
            comment TEXT
        )
        """
    )
    op.execute("CREATE INDEX idx_stock_revision_lines_revision ON stock_revision_lines (revision_id)")
    op.execute(
        "ALTER TABLE stock_movements ADD COLUMN revision_id BIGINT REFERENCES stock_revisions(id) ON DELETE SET NULL"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE stock_movements DROP COLUMN revision_id")
    op.execute("DROP TABLE stock_revision_lines")
    op.execute("DROP TABLE stock_revisions")
    op.execute("DROP TYPE stock_revision_status")
