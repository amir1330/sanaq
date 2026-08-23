"""staff receive permission

Revision ID: 004_staff_permissions
Revises: 003_leads
Create Date: 2026-08-23
"""

from typing import Sequence, Union

from alembic import op

revision: str = "004_staff_permissions"
down_revision: Union[str, None] = "003_leads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN can_receive_stock BOOLEAN NOT NULL DEFAULT false"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS can_receive_stock")
