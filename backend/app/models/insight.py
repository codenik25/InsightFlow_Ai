import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DatasetInsight(Base):
    __tablename__ = "dataset_insights"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String, nullable=False)  # KPI, PERFORMANCE, TREND, COMPARISON, CORRELATION, DATA_QUALITY, ANOMALY, OPPORTUNITY
    severity = Column(String, nullable=False)  # INFO, POSITIVE, WARNING, CRITICAL
    title = Column(String, nullable=False)
    observation = Column(String, nullable=False)
    evidence = Column(JSON, nullable=False)
    explanation = Column(String, nullable=True)
    recommendation = Column(String, nullable=True)
    priority_score = Column(Float, default=50.0, nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)
    source_column = Column(String, nullable=True)
    dimension = Column(String, nullable=True)
    metric_value = Column(Float, nullable=True)
    comparison_value = Column(Float, nullable=True)
    percentage_change = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    dataset = relationship("Dataset", backref="insights")
