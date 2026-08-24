"""webkassa fiscal fields on shops, products, sales, shifts

Revision ID: 007_webkassa
Revises: 006_stock_journal
Create Date: 2026-08-24
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007_webkassa"
down_revision: Union[str, None] = "006_stock_journal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE shops ADD COLUMN webkassa_login TEXT")
    op.execute("ALTER TABLE shops ADD COLUMN webkassa_password_encrypted TEXT")
    op.execute("ALTER TABLE shops ADD COLUMN webkassa_cashbox_number TEXT")
    op.execute("ALTER TABLE shops ADD COLUMN webkassa_api_key_encrypted TEXT")
    op.execute("ALTER TABLE shops ADD COLUMN webkassa_enabled BOOLEAN NOT NULL DEFAULT false")
    op.execute("ALTER TABLE products ADD COLUMN fiscal_position_code TEXT")
    op.execute("ALTER TABLE products ADD COLUMN tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE products ADD COLUMN tax_type INTEGER NOT NULL DEFAULT 0")
    op.execute("CREATE TYPE fiscal_status AS ENUM ('pending', 'sent', 'failed', 'skipped')")
    op.execute("ALTER TABLE sales ADD COLUMN fiscal_status fiscal_status")
    op.execute("UPDATE sales SET fiscal_status = 'skipped'")
    op.execute("ALTER TABLE sales ALTER COLUMN fiscal_status SET NOT NULL")
    op.execute("ALTER TABLE sales ALTER COLUMN fiscal_status SET DEFAULT 'pending'")
    op.execute("ALTER TABLE sales ADD COLUMN fiscal_receipt_number TEXT")
    op.execute("ALTER TABLE sales ADD COLUMN fiscal_receipt_url TEXT")
    op.execute("ALTER TABLE sales ADD COLUMN fiscal_error TEXT")
    op.execute("ALTER TABLE sales ADD COLUMN fiscal_attempts INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE shifts ADD COLUMN z_report_number TEXT")
    op.execute("ALTER TABLE shifts ADD COLUMN z_report_sent_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE shifts DROP COLUMN IF EXISTS z_report_sent_at")
    op.execute("ALTER TABLE shifts DROP COLUMN IF EXISTS z_report_number")
    op.execute("ALTER TABLE sales DROP COLUMN IF EXISTS fiscal_attempts")
    op.execute("ALTER TABLE sales DROP COLUMN IF EXISTS fiscal_error")
    op.execute("ALTER TABLE sales DROP COLUMN IF EXISTS fiscal_receipt_url")
    op.execute("ALTER TABLE sales DROP COLUMN IF EXISTS fiscal_receipt_number")
    op.execute("ALTER TABLE sales DROP COLUMN IF EXISTS fiscal_status")
    op.execute("DROP TYPE IF EXISTS fiscal_status")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS tax_type")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS tax_percent")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS fiscal_position_code")
    op.execute("ALTER TABLE shops DROP COLUMN IF EXISTS webkassa_enabled")
    op.execute("ALTER TABLE shops DROP COLUMN IF EXISTS webkassa_api_key_encrypted")
    op.execute("ALTER TABLE shops DROP COLUMN IF EXISTS webkassa_cashbox_number")
    op.execute("ALTER TABLE shops DROP COLUMN IF EXISTS webkassa_password_encrypted")
    op.execute("ALTER TABLE shops DROP COLUMN IF EXISTS webkassa_login")
