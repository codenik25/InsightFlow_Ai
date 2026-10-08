from datetime import datetime, timezone
import uuid
from sqlalchemy import String, DateTime, Integer, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AnalysisRun(Base):
    """
    Generalized Analysis Run ORM model.
    Tracks execution lifecycle, exact dataset version lineage, configuration,
    and output artifacts across all analytical engines.
    """
    __tablename__ = "analysis_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dataset_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, index=True
    )
    processed_dataset_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    run_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="RUNNING", index=True
    )
    configuration: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    input_artifacts: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_artifacts: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    # Relationships
    project = relationship("Project", foreign_keys=[project_id])
    dataset = relationship("Dataset", foreign_keys=[dataset_id])
    processed_dataset = relationship("Dataset", foreign_keys=[processed_dataset_id])
