import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DecisionExecution(Base):
    """
    ORM Model for Decision Execution Record (Phase 10).
    Represents the formal, controlled execution lifecycle of an approved decision.
    Tracks state transitions: READY -> PENDING_CONFIRMATION -> CONFIRMED -> EXECUTED -> OUTCOME_MONITORING.
    """
    __tablename__ = "decision_executions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    decision_id = Column(String(255), nullable=False, index=True)
    recommendation_id = Column(String(255), nullable=True, index=True)
    approval_id = Column(String(36), ForeignKey("decision_approvals.id", ondelete="SET NULL"), nullable=True)

    status = Column(String(50), nullable=False, default="READY", index=True)

    requested_by = Column(String(255), nullable=True)
    confirmed_by = Column(String(255), nullable=True)
    executed_by = Column(String(255), nullable=True)

    requested_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    execution_reference = Column(String(255), nullable=True)
    execution_result = Column(JSON, nullable=True, default=dict)
    failure_reason = Column(Text, nullable=True)
    execution_metadata = Column(JSON, nullable=True, default=dict)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    project = relationship("Project", backref="decision_executions")
    dataset = relationship("Dataset", backref="decision_executions")
    approval = relationship("DecisionApproval", backref="decision_executions")
    events = relationship("DecisionExecutionEvent", back_populates="execution", cascade="all, delete-orphan", order_by="DecisionExecutionEvent.created_at.asc()")

    def __repr__(self) -> str:
        return f"<DecisionExecution {self.id} for decision {self.decision_id}: {self.status}>"


class DecisionExecutionEvent(Base):
    """
    ORM Model for Decision Execution Events (Phase 10).
    Represents an immutable, append-only audit trail of execution events
    (REQUESTED, CONFIRMED, STARTED, COMPLETED, FAILED, NOT_EXECUTED, CLOSED).
    """
    __tablename__ = "decision_execution_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    execution_id = Column(String(36), ForeignKey("decision_executions.id", ondelete="CASCADE"), nullable=False, index=True)
    decision_id = Column(String(255), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)

    event_type = Column(String(50), nullable=False, index=True)
    from_status = Column(String(50), nullable=False)
    to_status = Column(String(50), nullable=False)

    actor = Column(String(255), nullable=False)
    rationale = Column(Text, nullable=False)
    event_metadata = Column("metadata", JSON, nullable=True, default=dict)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    execution = relationship("DecisionExecution", back_populates="events")
    project = relationship("Project", backref="decision_execution_events")

    def __repr__(self) -> str:
        return f"<DecisionExecutionEvent {self.event_type} on {self.execution_id} by {self.actor}>"
