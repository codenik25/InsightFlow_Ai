import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionOutcome(Base):
    """ORM Model for stored decision real-world outcomes and feedback evaluation."""
    __tablename__ = "decision_outcomes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    recommendation_id = Column(String(36), nullable=False, index=True)
    optimization_id = Column(String(36), ForeignKey("decision_optimizations.id", ondelete="CASCADE"), nullable=True, index=True)
    scenario_id = Column(String(255), nullable=True, index=True)
    ml_analysis_id = Column(String(36), ForeignKey("ml_analyses.id", ondelete="CASCADE"), nullable=True)

    expected_metric = Column(String(255), nullable=False)
    expected_value = Column(Float, nullable=False)

    actual_metric = Column(String(255), nullable=False)
    actual_value = Column(Float, nullable=False)

    absolute_error = Column(Float, nullable=False)
    percentage_error = Column(Float, nullable=False)
    achievement_percentage = Column(Float, nullable=False)
    objective = Column(String(50), nullable=False, default="maximize")
    outcome_status = Column(String(50), nullable=False, index=True)

    notes = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    evaluated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    dataset = relationship("Dataset", backref="decision_outcomes")
    optimization = relationship("DecisionOptimization", backref="decision_outcomes")
    ml_analysis = relationship("MLAnalysis", backref="decision_outcomes")
