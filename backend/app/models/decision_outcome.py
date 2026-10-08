import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionOutcome(Base):
    """ORM Model for stored decision real-world outcomes, verification, and learning loop."""
    __tablename__ = "decision_outcomes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    decision_id = Column(String(255), nullable=True, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    recommendation_id = Column(String(36), nullable=False, index=True)
    optimization_id = Column(String(36), ForeignKey("decision_optimizations.id", ondelete="CASCADE"), nullable=True, index=True)
    scenario_id = Column(String(255), nullable=True, index=True)
    ml_analysis_id = Column(String(36), ForeignKey("ml_analyses.id", ondelete="CASCADE"), nullable=True)

    expected_metric = Column(String(255), nullable=False)
    expected_value = Column(Float, nullable=False)

    actual_metric = Column(String(255), nullable=True)
    actual_value = Column(Float, nullable=True)

    absolute_delta = Column(Float, nullable=True)
    relative_delta = Column(Float, nullable=True)
    absolute_error = Column(Float, nullable=True)
    percentage_error = Column(Float, nullable=True)
    achievement_percentage = Column(Float, nullable=True)
    objective = Column(String(50), nullable=False, default="maximize")
    outcome_status = Column(String(50), nullable=False, index=True)

    source_dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True, index=True)
    source_dataset_version = Column(Integer, nullable=True)
    source_analysis_run_id = Column(String(36), ForeignKey("analysis_runs.id", ondelete="SET NULL"), nullable=True)
    threshold_used = Column(Float, nullable=True, default=0.05)
    learning_signal = Column(String(100), nullable=True)

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

    project = relationship("Project", foreign_keys=[project_id])
    dataset = relationship("Dataset", foreign_keys=[dataset_id], backref="decision_outcomes")
    source_dataset = relationship("Dataset", foreign_keys=[source_dataset_id])
    source_analysis_run = relationship("AnalysisRun", foreign_keys=[source_analysis_run_id])
    optimization = relationship("DecisionOptimization", backref="decision_outcomes")
    ml_analysis = relationship("MLAnalysis", backref="decision_outcomes")
