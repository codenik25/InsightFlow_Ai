import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionOptimization(Base):
    """ORM Model for stored decision optimizations and recommended operational scenarios."""
    __tablename__ = "decision_optimizations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    ml_analysis_id = Column(String(36), ForeignKey("ml_analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    objective = Column(String(50), nullable=False, default="maximize")
    target_column = Column(String(255), nullable=False)
    baseline_prediction = Column(Float, nullable=False, default=0.0)
    recommended_prediction = Column(Float, nullable=True)
    expected_change = Column(Float, nullable=True)
    expected_change_percent = Column(Float, nullable=True)
    optimization_score = Column(Float, nullable=True)
    constraints = Column(JSON, nullable=False, default=dict)
    recommended_scenario = Column(JSON, nullable=True)
    ranked_scenarios = Column(JSON, nullable=True)
    scenario_count = Column(Integer, nullable=False, default=0)
    status = Column(String(50), nullable=False, default="completed")
    selection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    dataset = relationship("Dataset", backref="decision_optimizations")
    ml_analysis = relationship("MLAnalysis", backref="decision_optimizations")
