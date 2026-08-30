import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionActionLog(Base):
    """ORM Model for Action Gate evaluation results and simulated action execution logs."""
    __tablename__ = "decision_action_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    decision_id = Column(String(255), nullable=True, index=True)
    recommendation_id = Column(String(255), nullable=False, index=True)
    approval_id = Column(String(36), ForeignKey("decision_approvals.id", ondelete="SET NULL"), nullable=True, index=True)

    action_state = Column(String(50), nullable=False, default="READY_FOR_ACTION", index=True)
    is_simulated = Column(Boolean, nullable=False, default=True)
    reason_code = Column(String(100), nullable=True)
    message = Column(Text, nullable=True)
    execution_details = Column(JSON, nullable=True, default=dict)

    executed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    dataset = relationship("Dataset", backref="action_logs")
    approval = relationship("DecisionApproval", backref="action_logs")
