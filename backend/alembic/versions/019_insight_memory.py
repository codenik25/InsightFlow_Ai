"""019_insight_memory: create insight_memories table

Revision ID: 019_insight_memory
Revises: 018_analysis_runs
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa


revision = "019_insight_memory"
down_revision = "018_analysis_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "insight_memories",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column(
            "project_id",
            sa.String(length=36),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dataset_lineage", sa.String(length=255), nullable=False),
        sa.Column("insight_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("affected_columns", sa.JSON(), nullable=True),
        sa.Column("latest_insight_id", sa.String(length=36), nullable=True),
        sa.Column(
            "first_seen_run_id",
            sa.String(length=36),
            sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "latest_run_id",
            sa.String(length=36),
            sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("first_seen_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("latest_seen_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="NEW"),
        sa.Column("strength_baseline", sa.Float(), nullable=True),
        sa.Column("strength_latest", sa.Float(), nullable=True),
        sa.Column("delta_magnitude", sa.Float(), nullable=True, server_default="0.0"),
        sa.Column("impact_summary", sa.Text(), nullable=True),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint(
            "project_id", "dataset_lineage", "insight_fingerprint",
            name="uq_project_lineage_fingerprint"
        ),
    )

    op.create_index("ix_insight_memories_project_id", "insight_memories", ["project_id"])
    op.create_index("ix_insight_memories_dataset_lineage", "insight_memories", ["dataset_lineage"])
    op.create_index("ix_insight_memories_insight_fingerprint", "insight_memories", ["insight_fingerprint"])
    op.create_index("ix_insight_memories_category", "insight_memories", ["category"])
    op.create_index("ix_insight_memories_status", "insight_memories", ["status"])
    op.create_index("ix_insight_memories_first_seen_run_id", "insight_memories", ["first_seen_run_id"])
    op.create_index("ix_insight_memories_latest_run_id", "insight_memories", ["latest_run_id"])


def downgrade() -> None:
    op.drop_index("ix_insight_memories_latest_run_id", table_name="insight_memories")
    op.drop_index("ix_insight_memories_first_seen_run_id", table_name="insight_memories")
    op.drop_index("ix_insight_memories_status", table_name="insight_memories")
    op.drop_index("ix_insight_memories_category", table_name="insight_memories")
    op.drop_index("ix_insight_memories_insight_fingerprint", table_name="insight_memories")
    op.drop_index("ix_insight_memories_dataset_lineage", table_name="insight_memories")
    op.drop_index("ix_insight_memories_project_id", table_name="insight_memories")
    op.drop_table("insight_memories")
