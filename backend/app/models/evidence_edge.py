import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EvidenceEdge(Base):
    """
    Generalized evidence relationship edge representing a verified link
    between analytical and decision entities across the InsightFlow platform.
    """
    __tablename__ = "evidence_edges"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(String(50), nullable=False)
    source_id = Column(String(255), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(String(255), nullable=False)
    relationship_type = Column(String(50), nullable=False)
    metadata_json = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "source_type",
            "source_id",
            "target_type",
            "target_id",
            "relationship_type",
            name="uq_evidence_edge",
        ),
        Index("ix_evidence_edges_source", "source_type", "source_id"),
        Index("ix_evidence_edges_target", "target_type", "target_id"),
        Index("ix_evidence_edges_rel", "relationship_type"),
    )

    project = relationship("Project", backref="evidence_edges")

    def __repr__(self) -> str:
        return (
            f"<EvidenceEdge {self.source_type}({self.source_id}) "
            f"-{self.relationship_type}-> {self.target_type}({self.target_id})>"
        )
