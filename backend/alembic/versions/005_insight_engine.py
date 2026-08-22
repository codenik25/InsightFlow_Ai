"""create dataset_insights table

Revision ID: 005_insight_engine
Revises: 004_eda_engine
Create Date: 2026-08-21 17:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_insight_engine'
down_revision: Union[str, None] = '004_eda_engine'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'dataset_insights',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('dataset_id', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('observation', sa.String(), nullable=False),
        sa.Column('evidence', sa.JSON(), nullable=False),
        sa.Column('explanation', sa.String(), nullable=True),
        sa.Column('recommendation', sa.String(), nullable=True),
        sa.Column('priority_score', sa.Float(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('source_column', sa.String(), nullable=True),
        sa.Column('dimension', sa.String(), nullable=True),
        sa.Column('metric_value', sa.Float(), nullable=True),
        sa.Column('comparison_value', sa.Float(), nullable=True),
        sa.Column('percentage_change', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dataset_insights_dataset_id'), 'dataset_insights', ['dataset_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_dataset_insights_dataset_id'), table_name='dataset_insights')
    op.drop_table('dataset_insights')
