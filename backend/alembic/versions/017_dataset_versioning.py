"""017_dataset_versioning: add version column to datasets table

Revision ID: 017_dataset_versioning
Revises: 016_workspace_and_project
Create Date: 2026-09-19
"""

from alembic import op
import sqlalchemy as sa


revision = "017_dataset_versioning"
down_revision = "016_workspace_and_project"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add version column to datasets with default value of 1
    op.add_column(
        "datasets",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index(
        op.f("ix_datasets_version"),
        "datasets",
        ["version"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_datasets_version"), table_name="datasets")
    op.drop_column("datasets", "version")
