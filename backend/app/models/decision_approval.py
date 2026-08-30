import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionApproval(Base):
    """ORM Model for stored human approvals for decisions/recommendations."""
    __tablename__ = "decision_approvals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    decision_id = Column(String(255), nullable=True, index=True)
    recommendation_id = Column(String(255), nullable=False, index=True)

    status = Column(String(50), nullable=False, default="WAITING_FOR_APPROVAL", index=True)
    requested_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    decided_at = Column(DateTime(timezone=True), nullable=True)

    actor_type = Column(String(50), nullable=False, default="USER")
    actor_id = Column(String(255), nullable=True)
    reason = Column(Text, nullable=True)
    approval_metadata = Column(JSON, nullable=True, default=dict)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    dataset = relationship("Dataset", backref="approvals")
