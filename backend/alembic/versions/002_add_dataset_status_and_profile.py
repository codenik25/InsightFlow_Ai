"""add status and profile_data columns to datasets

Revision ID: 002_add_dataset_status_and_profile
Revises: 001_initial_dataset_schema
Create Date: 2026-08-21 10:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002_dataset_profile'
down_revision: Union[str, None] = '001_initial_dataset_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('datasets', sa.Column('status', sa.String(length=50), nullable=False, server_default='uploaded'))
    op.add_column('datasets', sa.Column('profile_data', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('datasets', 'profile_data')
    op.drop_column('datasets', 'status')
