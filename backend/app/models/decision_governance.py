import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DecisionGovernanceEvent(Base):
    """
    ORM Model for Decision Governance Events (Phase 9).
    Represents an immutable, append-only history record of human governance
    transitions (review, approval, escalation, hold, rejection, execution, closing).
    """
    __tablename__ = "decision_governance_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    decision_id = Column(String(255), nullable=False, index=True)
    recommendation_id = Column(String(255), nullable=True, index=True)
    approval_id = Column(String(36), ForeignKey("decision_approvals.id", ondelete="SET NULL"), nullable=True)

    from_status = Column(String(50), nullable=False, index=True)
    to_status = Column(String(50), nullable=False, index=True)
    action = Column(String(50), nullable=False, index=True)

    actor = Column(String(255), nullable=False)
    review_notes = Column(Text, nullable=True)
    evidence_snapshot = Column(JSON, nullable=True, default=dict)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    project = relationship("Project", backref="decision_governance_events")
    dataset = relationship("Dataset", backref="governance_events")
    approval = relationship("DecisionApproval", backref="governance_events")

    def __repr__(self) -> str:
        return f"<DecisionGovernanceEvent {self.decision_id}: {self.from_status} -> {self.to_status} by {self.actor}>"
