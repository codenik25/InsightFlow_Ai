import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class MLAnalysis(Base):
    """OR Model for stored Machine Learning analyses and model metadata."""
    __tablename__ = "ml_analyses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    task_type = Column(String(50), nullable=False, index=True)
    target_column = Column(String(255), nullable=True)
    feature_columns = Column(JSON, nullable=False, default=list)
    model_name = Column(String(100), nullable=False)
    model_version = Column(String(20), default="1.0", nullable=False)
    model_artifact_path = Column(String(512), nullable=True)
    feature_schema = Column(JSON, nullable=True)
    preprocessing_config = Column(JSON, nullable=True)
    random_seed = Column(Integer, default=42, nullable=False)
    training_row_count = Column(Integer, nullable=False, default=0)
    test_row_count = Column(Integer, nullable=False, default=0)
    metrics = Column(JSON, nullable=False, default=dict)
    status = Column(String(50), default="completed", nullable=False)
    result_data = Column(JSON, nullable=True)
    selection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    dataset = relationship("Dataset", backref="ml_analyses")
