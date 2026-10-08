"""Phase 14: Decision Knowledge & Operating Memory ORM Model.

Persistent model for human-recorded and system-derived institutional knowledge,
observations, lessons, and operational notes across a project's decision lifecycle.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DecisionKnowledgeEntry(Base):
    """
    ORM Model for persistent Decision Knowledge & Operating Memory (Phase 14).
    Represents factual, attributed historical notes, lessons, and assumptions.
    Strictly distinguishes between HUMAN_RECORDED and SYSTEM_DERIVED knowledge.
    """
    __tablename__ = "decision_knowledge_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    decision_id = Column(String(255), nullable=True, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)

    # Categories: OBSERVATION, DECISION_LESSON, OUTCOME_LESSON, OPERATIONAL_NOTE, ASSUMPTION, CONSTRAINT
    category = Column(String(50), nullable=False, index=True)

    # Source types: DECISION, OUTCOME, LEARNING_SIGNAL, INSIGHT, DATASET, ANALYSIS_RUN, GOVERNANCE_EVENT, EXECUTION_EVENT, USER
    source_type = Column(String(50), nullable=False, default="USER", index=True)
    source_id = Column(String(255), nullable=False, default="USER", index=True)

    # Entry types: HUMAN_RECORDED vs SYSTEM_DERIVED
    entry_type = Column(String(30), nullable=False, default="HUMAN_RECORDED", index=True)

    created_by = Column(String(255), nullable=True)
    is_archived = Column(Boolean, nullable=False, default=False, index=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    project = relationship("Project", backref="decision_knowledge_entries")
    dataset = relationship("Dataset", backref="decision_knowledge_entries")

    def __repr__(self) -> str:
        return f"<DecisionKnowledgeEntry {self.id} [{self.category} / {self.entry_type}]: {self.title[:30]}>"
