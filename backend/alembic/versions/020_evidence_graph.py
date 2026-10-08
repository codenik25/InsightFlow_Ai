"""020_evidence_graph: create evidence_edges table

Revision ID: 020_evidence_graph
Revises: 019_insight_memory
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa


revision = "020_evidence_graph"
down_revision = "019_insight_memory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "evidence_edges",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column(
            "project_id",
            sa.String(length=36),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.String(length=255), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=False),
        sa.Column("target_id", sa.String(length=255), nullable=False),
        sa.Column("relationship_type", sa.String(length=50), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint(
            "project_id",
            "source_type",
            "source_id",
            "target_type",
            "target_id",
            "relationship_type",
            name="uq_evidence_edge",
        ),
    )

    op.create_index(
        "ix_evidence_edges_project_id",
        "evidence_edges",
        ["project_id"],
    )
    op.create_index(
        "ix_evidence_edges_source",
        "evidence_edges",
        ["source_type", "source_id"],
    )
    op.create_index(
        "ix_evidence_edges_target",
        "evidence_edges",
        ["target_type", "target_id"],
    )
    op.create_index(
        "ix_evidence_edges_rel",
        "evidence_edges",
        ["relationship_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_evidence_edges_rel", table_name="evidence_edges")
    op.drop_index("ix_evidence_edges_target", table_name="evidence_edges")
    op.drop_index("ix_evidence_edges_source", table_name="evidence_edges")
    op.drop_index("ix_evidence_edges_project_id", table_name="evidence_edges")
    op.drop_table("evidence_edges")
