"""create decision_recommendation_evaluations table

Revision ID: 009_decision_recommendations
Revises: 008_decision_optimization
Create Date: 2026-08-22 09:54:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '009_decision_recommendations'
down_revision: Union[str, None] = '008_decision_optimization'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'decision_recommendation_evaluations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('dataset_id', sa.String(length=36), nullable=False),
        sa.Column('ml_analysis_id', sa.String(length=36), nullable=False),
        sa.Column('optimization_id', sa.String(length=36), nullable=False),
        sa.Column('scenario_id', sa.String(length=255), nullable=True),
        sa.Column('recommendation_type', sa.String(length=50), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('target_metric', sa.String(length=255), nullable=False),
        sa.Column('baseline_value', sa.Float(), nullable=False),
        sa.Column('projected_value', sa.Float(), nullable=False),
        sa.Column('absolute_delta', sa.Float(), nullable=False),
        sa.Column('percentage_delta', sa.Float(), nullable=False),
        sa.Column('changed_features', sa.JSON(), nullable=False),
        sa.Column('rationale', sa.Text(), nullable=False),
        sa.Column('tradeoffs', sa.Text(), nullable=False),
        sa.Column('confidence', sa.String(length=50), nullable=False),
        sa.Column('evidence', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ml_analysis_id'], ['ml_analyses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['optimization_id'], ['decision_optimizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_decision_recommendation_evaluations_dataset_id'), 'decision_recommendation_evaluations', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_decision_recommendation_evaluations_ml_analysis_id'), 'decision_recommendation_evaluations', ['ml_analysis_id'], unique=False)
    op.create_index(op.f('ix_decision_recommendation_evaluations_optimization_id'), 'decision_recommendation_evaluations', ['optimization_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_decision_recommendation_evaluations_optimization_id'), table_name='decision_recommendation_evaluations')
    op.drop_index(op.f('ix_decision_recommendation_evaluations_ml_analysis_id'), table_name='decision_recommendation_evaluations')
    op.drop_index(op.f('ix_decision_recommendation_evaluations_dataset_id'), table_name='decision_recommendation_evaluations')
    op.drop_table('decision_recommendation_evaluations')
