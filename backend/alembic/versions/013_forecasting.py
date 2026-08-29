"""013_forecasting: create forecast_analyses table for Demand Forecasting Engine

Revision ID: 013_forecasting
Revises: 012_decision_outcomes
Create Date: 2026-08-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "013_forecasting"
down_revision = "012_decision_outcomes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "forecast_analyses",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("target_column", sa.String(length=255), nullable=False),
        sa.Column("time_column", sa.String(length=255), nullable=False),
        sa.Column("horizon", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.String(length=50), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("forecast_data", sa.JSON(), nullable=False),
        sa.Column("insights", sa.JSON(), nullable=True),
        sa.Column("warnings", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_forecast_analyses_dataset_id"), "forecast_analyses", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_forecast_analyses_created_at"), "forecast_analyses", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_forecast_analyses_created_at"), table_name="forecast_analyses")
    op.drop_index(op.f("ix_forecast_analyses_dataset_id"), table_name="forecast_analyses")
    op.drop_table("forecast_analyses")
