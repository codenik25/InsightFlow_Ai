import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionRecommendationEvaluation(Base):
    """ORM Model for stored executive decision recommendation evaluations."""
    __tablename__ = "decision_recommendation_evaluations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    ml_analysis_id = Column(String(36), ForeignKey("ml_analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    optimization_id = Column(String(36), ForeignKey("decision_optimizations.id", ondelete="CASCADE"), nullable=False, index=True)
    scenario_id = Column(String(255), nullable=True)
    recommendation_type = Column(String(50), nullable=False)
    priority = Column(Integer, nullable=False, default=1)
    title = Column(String(255), nullable=False)
    target_metric = Column(String(255), nullable=False)
    baseline_value = Column(Float, nullable=False, default=0.0)
    projected_value = Column(Float, nullable=False, default=0.0)
    absolute_delta = Column(Float, nullable=False, default=0.0)
    percentage_delta = Column(Float, nullable=False, default=0.0)
    changed_features = Column(JSON, nullable=False, default=dict)
    rationale = Column(Text, nullable=False)
    tradeoffs = Column(Text, nullable=False)
    confidence = Column(String(50), nullable=False, default="EXPLORATORY")
    evidence = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    dataset = relationship("Dataset", backref="recommendation_evaluations")
    ml_analysis = relationship("MLAnalysis", backref="recommendation_evaluations")
    optimization = relationship("DecisionOptimization", backref="recommendation_evaluations")
