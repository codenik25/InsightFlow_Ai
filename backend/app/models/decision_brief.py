import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionBrief(Base):
    """ORM Model for persisted AI Decision Briefs."""
    __tablename__ = "decision_briefs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    recommendation_id = Column(String(36), nullable=False, index=True)
    provider_name = Column(String(50), nullable=False, default="deterministic_fallback")
    model_name = Column(String(100), nullable=False, default="rule_template_v1")
    generation_mode = Column(String(50), nullable=False, default="deterministic_fallback")
    validation_status = Column(String(50), nullable=False, default="validated")
    fallback_reason = Column(Text, nullable=True)

    executive_summary = Column(Text, nullable=False)
    sections = Column(JSON, nullable=False, default=list)
    key_findings = Column(JSON, nullable=False, default=list)
    risk_breakdown = Column(JSON, nullable=False, default=dict)
    claim_evidence_map = Column(JSON, nullable=False, default=list)
    prompt_hash = Column(String(64), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    dataset = relationship("Dataset", backref="decision_briefs")

