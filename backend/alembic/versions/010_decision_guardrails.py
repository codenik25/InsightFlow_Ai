"""create decision_guardrail_evaluations table

Revision ID: 010_decision_guardrails
Revises: 009_decision_recommendations
Create Date: 2026-08-22 10:08:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '010_decision_guardrails'
down_revision: Union[str, None] = '009_decision_recommendations'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'decision_guardrail_evaluations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('dataset_id', sa.String(length=36), nullable=False),
        sa.Column('ml_analysis_id', sa.String(length=36), nullable=False),
        sa.Column('optimization_id', sa.String(length=36), nullable=False),
        sa.Column('recommendation_id', sa.String(length=36), nullable=False),
        sa.Column('scenario_id', sa.String(length=255), nullable=True),
        sa.Column('feasibility_score', sa.Float(), nullable=False),
        sa.Column('realism_score', sa.Float(), nullable=False),
        sa.Column('risk_score', sa.Float(), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False),
        sa.Column('decision_readiness_score', sa.Float(), nullable=False),
        sa.Column('feasibility_status', sa.String(length=50), nullable=False),
        sa.Column('risk_level', sa.String(length=50), nullable=False),
        sa.Column('decision_status', sa.String(length=50), nullable=False),
        sa.Column('guardrail_results', sa.JSON(), nullable=False),
        sa.Column('passed_rules', sa.JSON(), nullable=False),
        sa.Column('warnings', sa.JSON(), nullable=False),
        sa.Column('violated_rules', sa.JSON(), nullable=False),
        sa.Column('explanation', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ml_analysis_id'], ['ml_analyses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['optimization_id'], ['decision_optimizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recommendation_id'], ['decision_recommendation_evaluations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_decision_guardrail_evaluations_dataset_id'), 'decision_guardrail_evaluations', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_decision_guardrail_evaluations_ml_analysis_id'), 'decision_guardrail_evaluations', ['ml_analysis_id'], unique=False)
    op.create_index(op.f('ix_decision_guardrail_evaluations_optimization_id'), 'decision_guardrail_evaluations', ['optimization_id'], unique=False)
    op.create_index(op.f('ix_decision_guardrail_evaluations_recommendation_id'), 'decision_guardrail_evaluations', ['recommendation_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_decision_guardrail_evaluations_recommendation_id'), table_name='decision_guardrail_evaluations')
    op.drop_index(op.f('ix_decision_guardrail_evaluations_optimization_id'), table_name='decision_guardrail_evaluations')
    op.drop_index(op.f('ix_decision_guardrail_evaluations_ml_analysis_id'), table_name='decision_guardrail_evaluations')
    op.drop_index(op.f('ix_decision_guardrail_evaluations_dataset_id'), table_name='decision_guardrail_evaluations')
    op.drop_table('decision_guardrail_evaluations')
