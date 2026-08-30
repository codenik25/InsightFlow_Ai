"""015_add_phase8_capabilities: create tables for impact, audit, approval, action, and ai_evaluation

Revision ID: 015_add_phase8_capabilities
Revises: 014_anomaly_intelligence
Create Date: 2026-08-29
"""

from alembic import op
import sqlalchemy as sa

revision = "015_add_phase8_capabilities"
down_revision = "014_anomaly_intelligence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. decision_impact_measurements
    op.create_table(
        "decision_impact_measurements",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("decision_id", sa.String(length=255), nullable=True),
        sa.Column("recommendation_id", sa.String(length=255), nullable=False),
        sa.Column("outcome_id", sa.String(length=36), nullable=True),
        sa.Column("metric_name", sa.String(length=255), nullable=False),
        sa.Column("objective", sa.String(length=50), nullable=False, server_default="maximize"),
        sa.Column("baseline_value", sa.Float(), nullable=True, server_default="0.0"),
        sa.Column("expected_value", sa.Float(), nullable=True),
        sa.Column("actual_value", sa.Float(), nullable=True),
        sa.Column("expected_change", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("actual_change", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("variance", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("achievement_percentage", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="MEASURED"),
        sa.Column("value_created", sa.Float(), nullable=True),
        sa.Column("value_unit", sa.String(length=50), nullable=True, server_default="metric_units"),
        sa.Column("monetary_conversion_rate", sa.Float(), nullable=True),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["outcome_id"], ["decision_outcomes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_decision_impact_measurements_dataset_id"), "decision_impact_measurements", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_decision_impact_measurements_decision_id"), "decision_impact_measurements", ["decision_id"], unique=False)
    op.create_index(op.f("ix_decision_impact_measurements_recommendation_id"), "decision_impact_measurements", ["recommendation_id"], unique=False)
    op.create_index(op.f("ix_decision_impact_measurements_outcome_id"), "decision_impact_measurements", ["outcome_id"], unique=False)
    op.create_index(op.f("ix_decision_impact_measurements_status"), "decision_impact_measurements", ["status"], unique=False)
    op.create_index(op.f("ix_decision_impact_measurements_measured_at"), "decision_impact_measurements", ["measured_at"], unique=False)

    # 2. decision_audit_events
    op.create_table(
        "decision_audit_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("decision_id", sa.String(length=255), nullable=True),
        sa.Column("recommendation_id", sa.String(length=255), nullable=True),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("event_status", sa.String(length=50), nullable=False, server_default="SUCCESS"),
        sa.Column("actor_type", sa.String(length=50), nullable=False, server_default="SYSTEM"),
        sa.Column("actor_id", sa.String(length=255), nullable=True),
        sa.Column("source_service", sa.String(length=100), nullable=False, server_default="decision_service"),
        sa.Column("evidence_references", sa.JSON(), nullable=False),
        sa.Column("previous_state", sa.JSON(), nullable=True),
        sa.Column("new_state", sa.JSON(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_decision_audit_events_dataset_id"), "decision_audit_events", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_decision_audit_events_decision_id"), "decision_audit_events", ["decision_id"], unique=False)
    op.create_index(op.f("ix_decision_audit_events_recommendation_id"), "decision_audit_events", ["recommendation_id"], unique=False)
    op.create_index(op.f("ix_decision_audit_events_event_type"), "decision_audit_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_decision_audit_events_event_status"), "decision_audit_events", ["event_status"], unique=False)
    op.create_index(op.f("ix_decision_audit_events_timestamp"), "decision_audit_events", ["timestamp"], unique=False)

    # 3. decision_approvals
    op.create_table(
        "decision_approvals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("decision_id", sa.String(length=255), nullable=True),
        sa.Column("recommendation_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="WAITING_FOR_APPROVAL"),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actor_type", sa.String(length=50), nullable=False, server_default="USER"),
        sa.Column("actor_id", sa.String(length=255), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("approval_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_decision_approvals_dataset_id"), "decision_approvals", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_decision_approvals_decision_id"), "decision_approvals", ["decision_id"], unique=False)
    op.create_index(op.f("ix_decision_approvals_recommendation_id"), "decision_approvals", ["recommendation_id"], unique=False)
    op.create_index(op.f("ix_decision_approvals_status"), "decision_approvals", ["status"], unique=False)

    # 4. decision_action_logs
    op.create_table(
        "decision_action_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("decision_id", sa.String(length=255), nullable=True),
        sa.Column("recommendation_id", sa.String(length=255), nullable=False),
        sa.Column("approval_id", sa.String(length=36), nullable=True),
        sa.Column("action_state", sa.String(length=50), nullable=False, server_default="READY_FOR_ACTION"),
        sa.Column("is_simulated", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("reason_code", sa.String(length=100), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("execution_details", sa.JSON(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approval_id"], ["decision_approvals.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_decision_action_logs_dataset_id"), "decision_action_logs", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_decision_action_logs_decision_id"), "decision_action_logs", ["decision_id"], unique=False)
    op.create_index(op.f("ix_decision_action_logs_recommendation_id"), "decision_action_logs", ["recommendation_id"], unique=False)
    op.create_index(op.f("ix_decision_action_logs_approval_id"), "decision_action_logs", ["approval_id"], unique=False)
    op.create_index(op.f("ix_decision_action_logs_action_state"), "decision_action_logs", ["action_state"], unique=False)

    # 5. decision_ai_evaluations
    op.create_table(
        "decision_ai_evaluations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("decision_id", sa.String(length=255), nullable=True),
        sa.Column("brief_id", sa.String(length=36), nullable=True),
        sa.Column("recommendation_id", sa.String(length=255), nullable=True),
        sa.Column("evaluation_version", sa.String(length=50), nullable=False, server_default="v1"),
        sa.Column("overall_status", sa.String(length=50), nullable=False, server_default="PASS"),
        sa.Column("overall_score", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("dimension_scores", sa.JSON(), nullable=False),
        sa.Column("violations", sa.JSON(), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["brief_id"], ["decision_briefs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_decision_ai_evaluations_dataset_id"), "decision_ai_evaluations", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_decision_ai_evaluations_decision_id"), "decision_ai_evaluations", ["decision_id"], unique=False)
    op.create_index(op.f("ix_decision_ai_evaluations_brief_id"), "decision_ai_evaluations", ["brief_id"], unique=False)
    op.create_index(op.f("ix_decision_ai_evaluations_overall_status"), "decision_ai_evaluations", ["overall_status"], unique=False)


def downgrade() -> None:
    op.drop_table("decision_ai_evaluations")
    op.drop_table("decision_action_logs")
    op.drop_table("decision_approvals")
    op.drop_table("decision_audit_events")
    op.drop_table("decision_impact_measurements")
