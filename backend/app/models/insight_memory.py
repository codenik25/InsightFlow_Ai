from datetime import datetime, timezone
import uuid
from sqlalchemy import String, DateTime, Integer, Float, Text, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InsightMemory(Base):
    """
    Persistent Insight Memory model across dataset versions and analysis runs.
    Tracks state transitions (NEW, PERSISTED, STRENGTHENED, WEAKENED, DISAPPEARED)
    and strength delta using a deterministic fingerprint.
    """
    __tablename__ = "insight_memories"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dataset_lineage: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    insight_fingerprint: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    affected_columns: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )
    latest_insight_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True
    )
    first_seen_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    latest_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    first_seen_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )
    latest_seen_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="NEW", index=True
    )
    strength_baseline: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    strength_latest: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    delta_magnitude: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=0.0
    )
    impact_summary: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "project_id", "dataset_lineage", "insight_fingerprint",
            name="uq_project_lineage_fingerprint"
        ),
    )

    # Relationships
    project = relationship("Project", foreign_keys=[project_id])
    first_seen_run = relationship("AnalysisRun", foreign_keys=[first_seen_run_id])
    latest_run = relationship("AnalysisRun", foreign_keys=[latest_run_id])
