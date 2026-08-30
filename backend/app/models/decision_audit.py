import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionAuditEvent(Base):
    """ORM Model for append-only Decision Audit Trail events."""
    __tablename__ = "decision_audit_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    decision_id = Column(String(255), nullable=True, index=True)
    recommendation_id = Column(String(255), nullable=True, index=True)

    event_type = Column(String(100), nullable=False, index=True)
    event_status = Column(String(50), nullable=False, default="SUCCESS", index=True)
    actor_type = Column(String(50), nullable=False, default="SYSTEM")
    actor_id = Column(String(255), nullable=True)
    source_service = Column(String(100), nullable=False, default="decision_service")

    evidence_references = Column(JSON, nullable=False, default=dict)
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True, default=dict)

    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    dataset = relationship("Dataset", backref="audit_events")
