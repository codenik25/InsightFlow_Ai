"""016_workspace_and_project: create workspaces and projects tables, add project_id to datasets

Revision ID: 016_workspace_and_project
Revises: 015_add_phase8_capabilities
Create Date: 2026-09-19
"""

import uuid
from alembic import op
import sqlalchemy as sa

revision = "016_workspace_and_project"
down_revision = "015_add_phase8_capabilities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create workspaces table
    op.create_table(
        "workspaces",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_workspaces_name"), "workspaces", ["name"], unique=False)

    # 2. Create projects table
    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_projects_name"), "projects", ["name"], unique=False)
    op.create_index(op.f("ix_projects_workspace_id"), "projects", ["workspace_id"], unique=False)

    # 3. Add project_id to datasets table
    op.add_column("datasets", sa.Column("project_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_datasets_project_id",
        "datasets",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_datasets_project_id"), "datasets", ["project_id"], unique=False)

    # 4. Seed default Workspace and Project, and associate existing datasets
    default_ws_id = str(uuid.uuid4())
    default_proj_id = str(uuid.uuid4())

    op.execute(
        f"INSERT INTO workspaces (id, name, description, created_at, updated_at) "
        f"VALUES ('{default_ws_id}', 'Nikunj''s Workspace', 'Primary workspace for Decision Intelligence', now(), now());"
    )
    op.execute(
        f"INSERT INTO projects (id, workspace_id, name, description, created_at, updated_at) "
        f"VALUES ('{default_proj_id}', '{default_ws_id}', 'Hospital Operations', 'Hospital operations, readmission intelligence, and resource optimization', now(), now());"
    )
    op.execute(
        f"UPDATE datasets SET project_id = '{default_proj_id}' WHERE project_id IS NULL;"
    )


def downgrade() -> None:
    op.drop_constraint("fk_datasets_project_id", "datasets", type_="foreignkey")
    op.drop_index(op.f("ix_datasets_project_id"), table_name="datasets")
    op.drop_column("datasets", "project_id")
    op.drop_index(op.f("ix_projects_workspace_id"), table_name="projects")
    op.drop_index(op.f("ix_projects_name"), table_name="projects")
    op.drop_table("projects")
    op.drop_index(op.f("ix_workspaces_name"), table_name="workspaces")
    op.drop_table("workspaces")
