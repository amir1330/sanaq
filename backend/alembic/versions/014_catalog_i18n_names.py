"""Optional Kazakh/English names for products and categories (menu i18n)."""

from alembic import op
import sqlalchemy as sa

revision = "014_catalog_i18n_names"
down_revision = "013_cash_registers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("categories", sa.Column("name_kk", sa.Text(), nullable=True))
    op.add_column("categories", sa.Column("name_en", sa.Text(), nullable=True))
    op.add_column("products", sa.Column("name_kk", sa.Text(), nullable=True))
    op.add_column("products", sa.Column("name_en", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "name_en")
    op.drop_column("products", "name_kk")
    op.drop_column("categories", "name_en")
    op.drop_column("categories", "name_kk")
