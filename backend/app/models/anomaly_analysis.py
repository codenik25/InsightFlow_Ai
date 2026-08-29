import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class AnomalyAnalysis(Base):
    """ORM Model for stored Anomaly Intelligence analyses."""
    __tablename__ = "anomaly_analyses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    total_observations = Column(Integer, nullable=False, default=0)
    anomaly_count = Column(Integer, nullable=False, default=0)
    anomaly_rate = Column(Float, nullable=False, default=0.0)
    high_severity_count = Column(Integer, nullable=False, default=0)
    confidence = Column(String(50), nullable=False, default="EXPLORATORY")
    feature_columns = Column(JSON, nullable=False, default=list)
    results_data = Column(JSON, nullable=False, default=dict)
    warnings = Column(JSON, nullable=True, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    dataset = relationship("Dataset", backref="anomaly_analyses")
