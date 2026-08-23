"""public signup leads

Revision ID: 003_leads
Revises: 002_shop_logo
Create Date: 2026-08-23
"""

from typing import Sequence, Union

from alembic import op

revision: str = "003_leads"
down_revision: Union[str, None] = "002_shop_logo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE leads (
            id            BIGSERIAL PRIMARY KEY,
            shop_name     TEXT NOT NULL,
            city          TEXT NOT NULL,
            contact_name  TEXT NOT NULL,
            phone         VARCHAR(32) NOT NULL,
            email         TEXT,
            comment       TEXT,
            status        VARCHAR(16) NOT NULL DEFAULT 'new',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX idx_leads_status ON leads (status, created_at DESC)")
    op.execute("CREATE INDEX idx_leads_phone ON leads (phone)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS leads")
