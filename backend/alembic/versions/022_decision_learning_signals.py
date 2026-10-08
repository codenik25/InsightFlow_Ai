"""022_decision_learning_signals: create decision_learning_signals table for Phase 8

Revision ID: 022_decision_learning_signals
Revises: 021_decision_outcomes
Create Date: 2026-09-21
"""

from alembic import op
import sqlalchemy as sa


revision = "022_decision_learning_signals"
down_revision = "021_decision_outcomes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decision_learning_signals",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("signal_type", sa.String(length=50), nullable=False),
        sa.Column("metric_name", sa.String(length=255), nullable=True),
        sa.Column("source_outcome_ids", sa.JSON(), nullable=False),
        sa.Column("source_decision_ids", sa.JSON(), nullable=False),
        sa.Column("source_ml_analysis_ids", sa.JSON(), nullable=True),
        sa.Column("source_dataset_ids", sa.JSON(), nullable=True),
        sa.Column("source_dataset_versions", sa.JSON(), nullable=True),
        sa.Column("sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("observed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("threshold_used", sa.Float(), nullable=True, server_default="0.05"),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="REVIEW"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="NEW"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("evidence_summary", sa.JSON(), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.String(length=255), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE", name="fk_decision_learning_signals_project_id"),
    )

    op.create_index("ix_decision_learning_signals_project_id", "decision_learning_signals", ["project_id"], unique=False)
    op.create_index("ix_decision_learning_signals_signal_type", "decision_learning_signals", ["signal_type"], unique=False)
    op.create_index("ix_decision_learning_signals_severity", "decision_learning_signals", ["severity"], unique=False)
    op.create_index("ix_decision_learning_signals_status", "decision_learning_signals", ["status"], unique=False)
    op.create_index("ix_decision_learning_signals_fingerprint", "decision_learning_signals", ["fingerprint"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_decision_learning_signals_fingerprint", table_name="decision_learning_signals")
    op.drop_index("ix_decision_learning_signals_status", table_name="decision_learning_signals")
    op.drop_index("ix_decision_learning_signals_severity", table_name="decision_learning_signals")
    op.drop_index("ix_decision_learning_signals_signal_type", table_name="decision_learning_signals")
    op.drop_index("ix_decision_learning_signals_project_id", table_name="decision_learning_signals")
    op.drop_table("decision_learning_signals")
