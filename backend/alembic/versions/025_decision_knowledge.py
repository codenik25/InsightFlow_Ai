"""025_decision_knowledge: create decision_knowledge_entries table for Phase 14

Revision ID: 025_decision_knowledge
Revises: 024_decision_execution
Create Date: 2026-09-22
"""

from alembic import op
import sqlalchemy as sa


revision = "025_decision_knowledge"
down_revision = "024_decision_execution"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decision_knowledge_entries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("decision_id", sa.String(length=255), nullable=True),
        sa.Column("dataset_id", sa.String(length=36), sa.ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.String(length=255), nullable=False),
        sa.Column("entry_type", sa.String(length=30), nullable=False, server_default="HUMAN_RECORDED"),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_decision_knowledge_entries_project_id", "decision_knowledge_entries", ["project_id"])
    op.create_index("ix_decision_knowledge_entries_decision_id", "decision_knowledge_entries", ["decision_id"])
    op.create_index("ix_decision_knowledge_entries_dataset_id", "decision_knowledge_entries", ["dataset_id"])
    op.create_index("ix_decision_knowledge_entries_category", "decision_knowledge_entries", ["category"])
    op.create_index("ix_decision_knowledge_entries_source_type", "decision_knowledge_entries", ["source_type"])
    op.create_index("ix_decision_knowledge_entries_source_id", "decision_knowledge_entries", ["source_id"])
    op.create_index("ix_decision_knowledge_entries_entry_type", "decision_knowledge_entries", ["entry_type"])
    op.create_index("ix_decision_knowledge_entries_is_archived", "decision_knowledge_entries", ["is_archived"])
    op.create_index("ix_decision_knowledge_entries_created_at", "decision_knowledge_entries", ["created_at"])


def downgrade() -> None:
    op.drop_table("decision_knowledge_entries")
