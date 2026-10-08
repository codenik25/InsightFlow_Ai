"""021_decision_outcomes: enhance decision_outcomes for Phase 6 Decision Outcome & Learning Loop

Revision ID: 021_decision_outcomes
Revises: 020_evidence_graph
Create Date: 2026-09-21
"""

from alembic import op
import sqlalchemy as sa


revision = "021_decision_outcomes"
down_revision = "020_evidence_graph"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add Phase 6 decision-centric and version-aware columns
    op.add_column("decision_outcomes", sa.Column("project_id", sa.String(length=36), nullable=True))
    op.add_column("decision_outcomes", sa.Column("decision_id", sa.String(length=255), nullable=True))
    op.add_column("decision_outcomes", sa.Column("absolute_delta", sa.Float(), nullable=True))
    op.add_column("decision_outcomes", sa.Column("relative_delta", sa.Float(), nullable=True))
    op.add_column("decision_outcomes", sa.Column("source_dataset_id", sa.String(length=36), nullable=True))
    op.add_column("decision_outcomes", sa.Column("source_dataset_version", sa.Integer(), nullable=True))
    op.add_column("decision_outcomes", sa.Column("source_analysis_run_id", sa.String(length=36), nullable=True))
    op.add_column("decision_outcomes", sa.Column("threshold_used", sa.Float(), nullable=True, server_default="0.05"))
    op.add_column("decision_outcomes", sa.Column("learning_signal", sa.String(length=100), nullable=True))

    # 2. Foreign Key constraints
    op.create_foreign_key(
        "fk_decision_outcomes_project_id",
        "decision_outcomes",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_decision_outcomes_source_dataset_id",
        "decision_outcomes",
        "datasets",
        ["source_dataset_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_decision_outcomes_source_analysis_run_id",
        "decision_outcomes",
        "analysis_runs",
        ["source_analysis_run_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 3. Create indexes for fast lookup
    op.create_index("ix_decision_outcomes_project_id", "decision_outcomes", ["project_id"], unique=False)
    op.create_index("ix_decision_outcomes_decision_id", "decision_outcomes", ["decision_id"], unique=False)
    op.create_index("ix_decision_outcomes_source_dataset_id", "decision_outcomes", ["source_dataset_id"], unique=False)

    # 4. Alter columns to nullable=True to support PENDING and non-ML decisions
    op.alter_column("decision_outcomes", "actual_metric", nullable=True)
    op.alter_column("decision_outcomes", "actual_value", nullable=True)
    op.alter_column("decision_outcomes", "absolute_error", nullable=True)
    op.alter_column("decision_outcomes", "percentage_error", nullable=True)
    op.alter_column("decision_outcomes", "achievement_percentage", nullable=True)
    op.alter_column("decision_outcomes", "optimization_id", nullable=True)
    op.alter_column("decision_outcomes", "ml_analysis_id", nullable=True)

    # 5. Backfill existing records with project_id and decision_id from datasets
    op.execute(
        """
        UPDATE decision_outcomes
        SET project_id = datasets.project_id,
            decision_id = decision_outcomes.recommendation_id,
            absolute_delta = decision_outcomes.actual_value - decision_outcomes.expected_value,
            relative_delta = CASE
                WHEN ABS(decision_outcomes.expected_value) > 1e-9
                THEN (decision_outcomes.actual_value - decision_outcomes.expected_value) / ABS(decision_outcomes.expected_value)
                ELSE 0.0
            END,
            threshold_used = 0.05
        FROM datasets
        WHERE decision_outcomes.dataset_id = datasets.id AND decision_outcomes.project_id IS NULL;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_decision_outcomes_source_dataset_id", table_name="decision_outcomes")
    op.drop_index("ix_decision_outcomes_decision_id", table_name="decision_outcomes")
    op.drop_index("ix_decision_outcomes_project_id", table_name="decision_outcomes")

    op.drop_constraint("fk_decision_outcomes_source_analysis_run_id", "decision_outcomes", type_="foreignkey")
    op.drop_constraint("fk_decision_outcomes_source_dataset_id", "decision_outcomes", type_="foreignkey")
    op.drop_constraint("fk_decision_outcomes_project_id", "decision_outcomes", type_="foreignkey")

    op.drop_column("decision_outcomes", "learning_signal")
    op.drop_column("decision_outcomes", "threshold_used")
    op.drop_column("decision_outcomes", "source_analysis_run_id")
    op.drop_column("decision_outcomes", "source_dataset_version")
    op.drop_column("decision_outcomes", "source_dataset_id")
    op.drop_column("decision_outcomes", "relative_delta")
    op.drop_column("decision_outcomes", "absolute_delta")
    op.drop_column("decision_outcomes", "decision_id")
    op.drop_column("decision_outcomes", "project_id")
