"""create scenarios and decision_recommendations tables

Revision ID: 007_decision_intelligence
Revises: 006_ml_predictive_engine
Create Date: 2026-08-22 09:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '007_decision_intelligence'
down_revision: Union[str, None] = '006_ml_predictive_engine'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Scenarios Table
    op.create_table(
        'scenarios',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('dataset_id', sa.String(length=36), nullable=False),
        sa.Column('ml_analysis_id', sa.String(length=36), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('target_column', sa.String(length=255), nullable=False),
        sa.Column('base_value', sa.Float(), nullable=False),
        sa.Column('feature_changes', sa.JSON(), nullable=False),
        sa.Column('predicted_outcome', sa.Float(), nullable=False),
        sa.Column('predicted_delta', sa.Float(), nullable=False),
        sa.Column('predicted_delta_percentage', sa.Float(), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ml_analysis_id'], ['ml_analyses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_scenarios_dataset_id'), 'scenarios', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_scenarios_ml_analysis_id'), 'scenarios', ['ml_analysis_id'], unique=False)

    # 2. Decision Recommendations Table
    op.create_table(
        'decision_recommendations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('dataset_id', sa.String(length=36), nullable=False),
        sa.Column('scenario_id', sa.String(length=36), nullable=True),
        sa.Column('ml_analysis_id', sa.String(length=36), nullable=True),
        sa.Column('insight_id', sa.String(length=36), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('recommendation_type', sa.String(length=50), nullable=False),
        sa.Column('impact_level', sa.String(length=20), nullable=False),
        sa.Column('expected_impact', sa.Text(), nullable=False),
        sa.Column('action_items', sa.JSON(), nullable=False),
        sa.Column('evidence_traceability', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ml_analysis_id'], ['ml_analyses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['insight_id'], ['dataset_insights.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_decision_recommendations_dataset_id'), 'decision_recommendations', ['dataset_id'], unique=False)
    op.create_index(op.f('ix_decision_recommendations_scenario_id'), 'decision_recommendations', ['scenario_id'], unique=False)
    op.create_index(op.f('ix_decision_recommendations_ml_analysis_id'), 'decision_recommendations', ['ml_analysis_id'], unique=False)
    op.create_index(op.f('ix_decision_recommendations_insight_id'), 'decision_recommendations', ['insight_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_decision_recommendations_insight_id'), table_name='decision_recommendations')
    op.drop_index(op.f('ix_decision_recommendations_ml_analysis_id'), table_name='decision_recommendations')
    op.drop_index(op.f('ix_decision_recommendations_scenario_id'), table_name='decision_recommendations')
    op.drop_index(op.f('ix_decision_recommendations_dataset_id'), table_name='decision_recommendations')
    op.drop_table('decision_recommendations')

    op.drop_index(op.f('ix_scenarios_ml_analysis_id'), table_name='scenarios')
    op.drop_index(op.f('ix_scenarios_dataset_id'), table_name='scenarios')
    op.drop_table('scenarios')
