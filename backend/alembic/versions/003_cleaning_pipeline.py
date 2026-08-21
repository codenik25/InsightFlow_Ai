"""add parent_id, is_processed to datasets and create transformation_logs table

Revision ID: 003_cleaning_pipeline
Revises: 002_dataset_profile
Create Date: 2026-08-21 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '003_cleaning_pipeline'
down_revision: Union[str, None] = '002_dataset_profile'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add parent_id and is_processed to datasets table
    op.add_column('datasets', sa.Column('parent_id', sa.String(length=36), nullable=True))
    op.add_column('datasets', sa.Column('is_processed', sa.Boolean(), server_default='false', nullable=False))
    op.create_index(op.f('ix_datasets_parent_id'), 'datasets', ['parent_id'], unique=False)
    op.create_foreign_key('fk_datasets_parent_id', 'datasets', 'datasets', ['parent_id'], ['id'], ondelete='SET NULL')

    # Create transformation_logs table
    op.create_table(
        'transformation_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('dataset_id', sa.String(length=36), nullable=False),
        sa.Column('output_dataset_id', sa.String(length=36), nullable=True),
        sa.Column('operation_type', sa.String(length=50), nullable=False),
        sa.Column('column_name', sa.String(length=255), nullable=True),
        sa.Column('strategy', sa.String(length=50), nullable=True),
        sa.Column('affected_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['output_dataset_id'], ['datasets.id'], ondelete='SET NULL')
    )
    op.create_index(op.f('ix_transformation_logs_dataset_id'), 'transformation_logs', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_transformation_logs_output_dataset_id'), 'transformation_logs', ['output_dataset_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_transformation_logs_output_dataset_id'), table_name='transformation_logs')
    op.drop_index(op.f('ix_transformation_logs_dataset_id'), table_name='transformation_logs')
    op.drop_table('transformation_logs')

    op.drop_constraint('fk_datasets_parent_id', 'datasets', type_='foreignkey')
    op.drop_index(op.f('ix_datasets_parent_id'), table_name='datasets')
    op.drop_column('datasets', 'is_processed')
    op.drop_column('datasets', 'parent_id')
