"""Multiple cash registers (tills) per shop; each open shift belongs to one till."""

from alembic import op
import sqlalchemy as sa

revision = "013_cash_registers"
down_revision = "012_stock_regrade_transfer"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cash_registers",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("shop_id", sa.BigInteger(), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("shop_id", "name", name="uq_cash_registers_shop_name"),
    )
    op.create_index("ix_cash_registers_shop_id", "cash_registers", ["shop_id"])

    # One default till per existing shop
    op.execute(
        """
        INSERT INTO cash_registers (shop_id, name, sort_order, is_active)
        SELECT id, 'Касса 1', 0, true FROM shops
        """
    )

    op.add_column("shifts", sa.Column("cash_register_id", sa.BigInteger(), nullable=True))
    op.execute(
        """
        UPDATE shifts AS s
        SET cash_register_id = (
            SELECT cr.id FROM cash_registers cr
            WHERE cr.shop_id = s.shop_id
            ORDER BY cr.sort_order, cr.id
            LIMIT 1
        )
        """
    )
    op.alter_column("shifts", "cash_register_id", nullable=False)
    op.create_foreign_key(
        "fk_shifts_cash_register_id",
        "shifts",
        "cash_registers",
        ["cash_register_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_shifts_cash_register_id", "shifts", ["cash_register_id"])
    # At most one open shift per till
    op.execute(
        """
        CREATE UNIQUE INDEX uq_shifts_open_per_register
        ON shifts (cash_register_id)
        WHERE status = 'open'
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_shifts_open_per_register")
    op.drop_index("ix_shifts_cash_register_id", table_name="shifts")
    op.drop_constraint("fk_shifts_cash_register_id", "shifts", type_="foreignkey")
    op.drop_column("shifts", "cash_register_id")
    op.drop_index("ix_cash_registers_shop_id", table_name="cash_registers")
    op.drop_table("cash_registers")
