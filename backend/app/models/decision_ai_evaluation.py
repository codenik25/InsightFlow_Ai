import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionAIEvaluation(Base):
    """ORM Model for stored AI Decision Brief / Decision Output evaluation records."""
    __tablename__ = "decision_ai_evaluations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    decision_id = Column(String(255), nullable=True, index=True)
    brief_id = Column(String(36), ForeignKey("decision_briefs.id", ondelete="SET NULL"), nullable=True, index=True)
    recommendation_id = Column(String(255), nullable=True, index=True)

    evaluation_version = Column(String(50), nullable=False, default="v1")
    overall_status = Column(String(50), nullable=False, default="PASS", index=True)
    overall_score = Column(Float, nullable=False, default=1.0)
    dimension_scores = Column(JSON, nullable=False, default=dict)
    violations = Column(JSON, nullable=False, default=list)

    evaluated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    dataset = relationship("Dataset", backref="ai_evaluations")
    brief = relationship("DecisionBrief", backref="ai_evaluations")
