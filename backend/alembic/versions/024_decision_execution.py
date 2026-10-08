"""024_decision_execution: create decision_executions and decision_execution_events tables for Phase 10

Revision ID: 024_decision_execution
Revises: 023_decision_governance
Create Date: 2026-09-21
"""

from alembic import op
import sqlalchemy as sa


revision = "024_decision_execution"
down_revision = "023_decision_governance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 0. Drop legacy constraint on decision_outcomes.recommendation_id if present
    op.execute("ALTER TABLE decision_outcomes DROP CONSTRAINT IF EXISTS decision_outcomes_recommendation_id_fkey;")

    # 1. Create decision_executions table
    op.create_table(
        "decision_executions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("decision_id", sa.String(length=255), nullable=False),
        sa.Column("recommendation_id", sa.String(length=255), nullable=True),
        sa.Column("approval_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="READY"),
        sa.Column("requested_by", sa.String(length=255), nullable=True),
        sa.Column("confirmed_by", sa.String(length=255), nullable=True),
        sa.Column("executed_by", sa.String(length=255), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("execution_reference", sa.String(length=255), nullable=True),
        sa.Column("execution_result", sa.JSON(), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("execution_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE", name="fk_decision_exec_project_id"),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE", name="fk_decision_exec_dataset_id"),
        sa.ForeignKeyConstraint(["approval_id"], ["decision_approvals.id"], ondelete="SET NULL", name="fk_decision_exec_approval_id"),
    )

    op.create_index("ix_decision_executions_decision_id", "decision_executions", ["decision_id"], unique=False)
    op.create_index("ix_decision_executions_project_id", "decision_executions", ["project_id"], unique=False)
    op.create_index("ix_decision_executions_dataset_id", "decision_executions", ["dataset_id"], unique=False)
    op.create_index("ix_decision_executions_status", "decision_executions", ["status"], unique=False)
    op.create_index("ix_decision_executions_created_at", "decision_executions", ["created_at"], unique=False)

    # 2. Create decision_execution_events table (append-only)
    op.create_table(
        "decision_execution_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("execution_id", sa.String(length=36), nullable=False),
        sa.Column("decision_id", sa.String(length=255), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("from_status", sa.String(length=50), nullable=False),
        sa.Column("to_status", sa.String(length=50), nullable=False),
        sa.Column("actor", sa.String(length=255), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["execution_id"], ["decision_executions.id"], ondelete="CASCADE", name="fk_decision_exec_events_exec_id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE", name="fk_decision_exec_events_project_id"),
    )

    op.create_index("ix_decision_execution_events_execution_id", "decision_execution_events", ["execution_id"], unique=False)
    op.create_index("ix_decision_execution_events_decision_id", "decision_execution_events", ["decision_id"], unique=False)
    op.create_index("ix_decision_execution_events_project_id", "decision_execution_events", ["project_id"], unique=False)
    op.create_index("ix_decision_execution_events_event_type", "decision_execution_events", ["event_type"], unique=False)
    op.create_index("ix_decision_execution_events_created_at", "decision_execution_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_decision_execution_events_created_at", table_name="decision_execution_events")
    op.drop_index("ix_decision_execution_events_event_type", table_name="decision_execution_events")
    op.drop_index("ix_decision_execution_events_project_id", table_name="decision_execution_events")
    op.drop_index("ix_decision_execution_events_decision_id", table_name="decision_execution_events")
    op.drop_index("ix_decision_execution_events_execution_id", table_name="decision_execution_events")
    op.drop_table("decision_execution_events")

    op.drop_index("ix_decision_executions_created_at", table_name="decision_executions")
    op.drop_index("ix_decision_executions_status", table_name="decision_executions")
    op.drop_index("ix_decision_executions_dataset_id", table_name="decision_executions")
    op.drop_index("ix_decision_executions_project_id", table_name="decision_executions")
    op.drop_index("ix_decision_executions_decision_id", table_name="decision_executions")
    op.drop_table("decision_executions")
