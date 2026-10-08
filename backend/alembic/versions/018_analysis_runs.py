"""018_analysis_runs: create analysis_runs table

Revision ID: 018_analysis_runs
Revises: 017_dataset_versioning
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa


revision = "018_analysis_runs"
down_revision = "017_dataset_versioning"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analysis_runs",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column(
            "project_id",
            sa.String(length=36),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "dataset_id",
            sa.String(length=36),
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dataset_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "processed_dataset_id",
            sa.String(length=36),
            sa.ForeignKey("datasets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("run_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="RUNNING"),
        sa.Column("configuration", sa.JSON(), nullable=True),
        sa.Column("input_artifacts", sa.JSON(), nullable=True),
        sa.Column("output_artifacts", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    op.create_index(
        op.f("ix_analysis_runs_project_id"),
        "analysis_runs",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_analysis_runs_dataset_id"),
        "analysis_runs",
        ["dataset_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_analysis_runs_run_type"),
        "analysis_runs",
        ["run_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_analysis_runs_status"),
        "analysis_runs",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_analysis_runs_created_at"),
        "analysis_runs",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_analysis_runs_created_at"), table_name="analysis_runs")
    op.drop_index(op.f("ix_analysis_runs_status"), table_name="analysis_runs")
    op.drop_index(op.f("ix_analysis_runs_run_type"), table_name="analysis_runs")
    op.drop_index(op.f("ix_analysis_runs_dataset_id"), table_name="analysis_runs")
    op.drop_index(op.f("ix_analysis_runs_project_id"), table_name="analysis_runs")
    op.drop_table("analysis_runs")
