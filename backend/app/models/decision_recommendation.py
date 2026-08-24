import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionRecommendation(Base):
    """ORM Model for evidence-backed recommendations derived from predictions and Phase 4 insights."""
    __tablename__ = "decision_recommendations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    scenario_id = Column(String(36), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=True, index=True)
    ml_analysis_id = Column(String(36), ForeignKey("ml_analyses.id", ondelete="CASCADE"), nullable=True, index=True)
    insight_id = Column(String(36), ForeignKey("dataset_insights.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    recommendation_type = Column(String(50), nullable=False, default="optimization")
    impact_level = Column(String(20), nullable=False, default="medium")
    expected_impact = Column(Text, nullable=False)
    action_items = Column(JSON, nullable=False, default=list)
    evidence_traceability = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    dataset = relationship("Dataset", backref="decision_recommendations")
    scenario = relationship("Scenario", backref="decision_recommendations")
    ml_analysis = relationship("MLAnalysis", backref="decision_recommendations")
    insight = relationship("DatasetInsight", backref="decision_recommendations")

