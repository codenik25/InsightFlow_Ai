"""create ml_analyses table

Revision ID: 006_ml_predictive_engine
Revises: 005_insight_engine
Create Date: 2026-08-22 09:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006_ml_predictive_engine'
down_revision: Union[str, None] = '005_insight_engine'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ml_analyses',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('dataset_id', sa.String(length=36), nullable=False),
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('target_column', sa.String(length=255), nullable=True),
        sa.Column('feature_columns', sa.JSON(), nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('model_version', sa.String(length=20), nullable=False),
        sa.Column('model_artifact_path', sa.String(length=512), nullable=True),
        sa.Column('feature_schema', sa.JSON(), nullable=True),
        sa.Column('preprocessing_config', sa.JSON(), nullable=True),
        sa.Column('random_seed', sa.Integer(), nullable=False),
        sa.Column('training_row_count', sa.Integer(), nullable=False),
        sa.Column('test_row_count', sa.Integer(), nullable=False),
        sa.Column('metrics', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('result_data', sa.JSON(), nullable=True),
        sa.Column('selection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ml_analyses_dataset_id'), 'ml_analyses', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_ml_analyses_task_type'), 'ml_analyses', ['task_type'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ml_analyses_task_type'), table_name='ml_analyses')
    op.drop_index(op.f('ix_ml_analyses_dataset_id'), table_name='ml_analyses')
    op.drop_table('ml_analyses')
