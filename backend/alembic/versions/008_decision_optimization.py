"""create decision_optimizations table

Revision ID: 008_decision_optimization
Revises: 007_decision_intelligence
Create Date: 2026-08-22 09:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '008_decision_optimization'
down_revision: Union[str, None] = '007_decision_intelligence'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'decision_optimizations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('dataset_id', sa.String(length=36), nullable=False),
        sa.Column('ml_analysis_id', sa.String(length=36), nullable=False),
        sa.Column('objective', sa.String(length=50), nullable=False),
        sa.Column('target_column', sa.String(length=255), nullable=False),
        sa.Column('baseline_prediction', sa.Float(), nullable=False),
        sa.Column('recommended_prediction', sa.Float(), nullable=True),
        sa.Column('expected_change', sa.Float(), nullable=True),
        sa.Column('expected_change_percent', sa.Float(), nullable=True),
        sa.Column('optimization_score', sa.Float(), nullable=True),
        sa.Column('constraints', sa.JSON(), nullable=False),
        sa.Column('recommended_scenario', sa.JSON(), nullable=True),
        sa.Column('ranked_scenarios', sa.JSON(), nullable=True),
        sa.Column('scenario_count', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('selection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ml_analysis_id'], ['ml_analyses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_decision_optimizations_dataset_id'), 'decision_optimizations', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_decision_optimizations_ml_analysis_id'), 'decision_optimizations', ['ml_analysis_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_decision_optimizations_ml_analysis_id'), table_name='decision_optimizations')
    op.drop_index(op.f('ix_decision_optimizations_dataset_id'), table_name='decision_optimizations')
    op.drop_table('decision_optimizations')
