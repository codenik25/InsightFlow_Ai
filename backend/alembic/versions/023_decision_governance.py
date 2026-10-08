"""023_decision_governance: create decision_governance_events table for Phase 9

Revision ID: 023_decision_governance
Revises: 022_decision_learning_signals
Create Date: 2026-09-21
"""

from alembic import op
import sqlalchemy as sa


revision = "023_decision_governance"
down_revision = "022_decision_learning_signals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decision_governance_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("decision_id", sa.String(length=255), nullable=False),
        sa.Column("recommendation_id", sa.String(length=255), nullable=True),
        sa.Column("approval_id", sa.String(length=36), nullable=True),
        sa.Column("from_status", sa.String(length=50), nullable=False),
        sa.Column("to_status", sa.String(length=50), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("actor", sa.String(length=255), nullable=False),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("evidence_snapshot", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE", name="fk_decision_gov_events_project_id"),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE", name="fk_decision_gov_events_dataset_id"),
        sa.ForeignKeyConstraint(["approval_id"], ["decision_approvals.id"], ondelete="SET NULL", name="fk_decision_gov_events_approval_id"),
    )

    op.create_index("ix_decision_governance_events_decision_id", "decision_governance_events", ["decision_id"], unique=False)
    op.create_index("ix_decision_governance_events_project_id", "decision_governance_events", ["project_id"], unique=False)
    op.create_index("ix_decision_governance_events_to_status", "decision_governance_events", ["to_status"], unique=False)
    op.create_index("ix_decision_governance_events_created_at", "decision_governance_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_decision_governance_events_created_at", table_name="decision_governance_events")
    op.drop_index("ix_decision_governance_events_to_status", table_name="decision_governance_events")
    op.drop_index("ix_decision_governance_events_project_id", table_name="decision_governance_events")
    op.drop_index("ix_decision_governance_events_decision_id", table_name="decision_governance_events")
    op.drop_table("decision_governance_events")
