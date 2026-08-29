"""014_anomaly_intelligence: create anomaly_analyses table for Production-Grade Anomaly Intelligence

Revision ID: 014_anomaly_intelligence
Revises: 013_forecasting
Create Date: 2026-08-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "014_anomaly_intelligence"
down_revision = "013_forecasting"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "anomaly_analyses",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("total_observations", sa.Integer(), nullable=False),
        sa.Column("anomaly_count", sa.Integer(), nullable=False),
        sa.Column("anomaly_rate", sa.Float(), nullable=False),
        sa.Column("high_severity_count", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.String(length=50), nullable=False),
        sa.Column("feature_columns", sa.JSON(), nullable=False),
        sa.Column("results_data", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_anomaly_analyses_dataset_id"), "anomaly_analyses", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_anomaly_analyses_created_at"), "anomaly_analyses", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_anomaly_analyses_created_at"), table_name="anomaly_analyses")
    op.drop_index(op.f("ix_anomaly_analyses_dataset_id"), table_name="anomaly_analyses")
    op.drop_table("anomaly_analyses")
