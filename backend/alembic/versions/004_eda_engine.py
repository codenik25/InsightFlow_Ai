"""create eda_analyses table

Revision ID: 004_eda_engine
Revises: 003_cleaning_pipeline
Create Date: 2026-08-21 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004_eda_engine'
down_revision: Union[str, None] = '003_cleaning_pipeline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'eda_analyses',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('dataset_id', sa.String(), nullable=False),
        sa.Column('analysis_version', sa.String(), nullable=False),
        sa.Column('result_data', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_eda_analyses_dataset_id'), 'eda_analyses', ['dataset_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_eda_analyses_dataset_id'), table_name='eda_analyses')
    op.drop_table('eda_analyses')
