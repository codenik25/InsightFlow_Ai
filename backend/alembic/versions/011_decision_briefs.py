"""011_decision_briefs: create decision_briefs table for AI Decision Brief Engine

Revision ID: 011_decision_briefs
Revises: 010_decision_guardrails
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "011_decision_briefs"
down_revision = "010_decision_guardrails"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decision_briefs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=False),
        sa.Column("recommendation_id", sa.String(length=36), nullable=False),
        sa.Column("provider_name", sa.String(length=50), nullable=False, server_default="deterministic_fallback"),
        sa.Column("model_name", sa.String(length=100), nullable=False, server_default="rule_template_v1"),
        sa.Column("generation_mode", sa.String(length=50), nullable=False, server_default="deterministic_fallback"),
        sa.Column("validation_status", sa.String(length=50), nullable=False, server_default="validated"),
        sa.Column("fallback_reason", sa.Text(), nullable=True),
        sa.Column("executive_summary", sa.Text(), nullable=False),
        sa.Column("sections", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("key_findings", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("risk_breakdown", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("claim_evidence_map", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("prompt_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recommendation_id"], ["decision_recommendation_evaluations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_decision_briefs_dataset_id"), "decision_briefs", ["dataset_id"], unique=False)
    op.create_index(op.f("ix_decision_briefs_recommendation_id"), "decision_briefs", ["recommendation_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_decision_briefs_recommendation_id"), table_name="decision_briefs")
    op.drop_index(op.f("ix_decision_briefs_dataset_id"), table_name="decision_briefs")
    op.drop_table("decision_briefs")
