import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DecisionLearningSignal(Base):
    """
    ORM Model for Decision Learning & Improvement Signals (Phase 8).
    Represents structured, auditable investigation cues for human analysts
    derived from Phase 7 performance patterns and Phase 6 outcome actuals.
    """
    __tablename__ = "decision_learning_signals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    signal_type = Column(String(50), nullable=False, index=True)

    metric_name = Column(String(255), nullable=True)

    source_outcome_ids = Column(JSON, nullable=False, default=list)
    source_decision_ids = Column(JSON, nullable=False, default=list)
    source_ml_analysis_ids = Column(JSON, nullable=True, default=list)
    source_dataset_ids = Column(JSON, nullable=True, default=list)
    source_dataset_versions = Column(JSON, nullable=True, default=list)

    sample_count = Column(Integer, nullable=False, default=0)
    observed_count = Column(Integer, nullable=False, default=0)

    threshold_used = Column(Float, nullable=True, default=0.05)

    severity = Column(String(20), nullable=False, default="REVIEW", index=True)
    status = Column(String(30), nullable=False, default="NEW", index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)

    evidence_summary = Column(JSON, nullable=False, default=dict)
    fingerprint = Column(String(64), nullable=False, index=True)

    review_notes = Column(Text, nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    project = relationship("Project", backref="decision_learning_signals")

    def __repr__(self) -> str:
        return f"<DecisionLearningSignal {self.signal_type}:{self.title} [{self.severity}|{self.status}]>"
