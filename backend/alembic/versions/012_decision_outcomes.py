"""012_decision_outcomes: create decision_outcomes table for Decision Memory & Outcome Feedback Engine

Revision ID: 012_decision_outcomes
Revises: 011_decision_briefs
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "012_decision_outcomes"
down_revision = "011_decision_briefs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decision_outcomes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("recommendation_id", sa.String(length=36), nullable=False),
        sa.Column("optimization_id", sa.String(length=36), nullable=False),
        sa.Column("scenario_id", sa.String(length=255), nullable=True),
        sa.Column("ml_analysis_id", sa.String(length=36), nullable=False),
        sa.Column("expected_metric", sa.String(length=255), nullable=False),
        sa.Column("expected_value", sa.Float(), nullable=False),
        sa.Column("actual_metric", sa.String(length=255), nullable=False),
        sa.Column("actual_value", sa.Float(), nullable=False),
        sa.Column("absolute_error", sa.Float(), nullable=False),
        sa.Column("percentage_error", sa.Float(), nullable=False),
        sa.Column("achievement_percentage", sa.Float(), nullable=False),
        sa.Column("objective", sa.String(length=50), nullable=False, server_default="maximize"),
        sa.Column("outcome_status", sa.String(length=50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recommendation_id"], ["decision_recommendation_evaluations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["optimization_id"], ["decision_optimizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ml_analysis_id"], ["ml_analyses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_decision_outcomes_dataset_id"), "decision_outcomes", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_decision_outcomes_recommendation_id"), "decision_outcomes", ["recommendation_id"], unique=False)
    op.create_index(op.f("ix_decision_outcomes_scenario_id"), "decision_outcomes", ["scenario_id"], unique=False)
    op.create_index(op.f("ix_decision_outcomes_outcome_status"), "decision_outcomes", ["outcome_status"], unique=False)
    op.create_index(op.f("ix_decision_outcomes_recorded_at"), "decision_outcomes", ["recorded_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_decision_outcomes_recorded_at"), table_name="decision_outcomes")
    op.drop_index(op.f("ix_decision_outcomes_outcome_status"), table_name="decision_outcomes")
    op.drop_index(op.f("ix_decision_outcomes_scenario_id"), table_name="decision_outcomes")
    op.drop_index(op.f("ix_decision_outcomes_recommendation_id"), table_name="decision_outcomes")
    op.drop_index(op.f("ix_decision_outcomes_dataset_id"), table_name="decision_outcomes")
    op.drop_table("decision_outcomes")
