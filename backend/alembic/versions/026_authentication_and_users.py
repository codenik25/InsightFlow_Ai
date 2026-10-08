"""026_authentication_and_users: create users table and add owner_id to workspaces

Revision ID: 026_authentication_and_users
Revises: 025_decision_knowledge
Create Date: 2026-09-26
"""

from alembic import op
import sqlalchemy as sa


revision = "026_authentication_and_users"
down_revision = "025_decision_knowledge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    # 1. Create users table if not exists
    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("hashed_password", sa.String(length=255), nullable=False),
            sa.Column("full_name", sa.String(length=255), nullable=False),
            sa.Column("role", sa.String(length=50), nullable=False, server_default="Admin"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_users_email", "users", ["email"], unique=True)
    else:
        indexes = [idx["name"] for idx in insp.get_indexes("users")]
        if "ix_users_email" not in indexes:
            try:
                op.create_index("ix_users_email", "users", ["email"], unique=True)
            except Exception:
                pass

    # 2. Add owner_id to workspaces table if not present
    ws_columns = [col["name"] for col in insp.get_columns("workspaces")]
    if "owner_id" not in ws_columns:
        op.add_column("workspaces", sa.Column("owner_id", sa.String(length=36), nullable=True))
        try:
            op.create_foreign_key(
                "fk_workspaces_owner_id_users",
                "workspaces",
                "users",
                ["owner_id"],
                ["id"],
                ondelete="SET NULL",
            )
        except Exception:
            pass
        try:
            op.create_index("ix_workspaces_owner_id", "workspaces", ["owner_id"])
        except Exception:
            pass


def downgrade() -> None:
    op.drop_index("ix_workspaces_owner_id", table_name="workspaces")
    op.drop_constraint("fk_workspaces_owner_id_users", table_name="workspaces", type_="foreignkey")
    op.drop_column("workspaces", "owner_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
