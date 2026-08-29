import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class ForecastAnalysis(Base):
    """ORM Model for stored Demand Forecast analyses."""
    __tablename__ = "forecast_analyses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    target_column = Column(String(255), nullable=False)
    time_column = Column(String(255), nullable=False)
    horizon = Column(Integer, nullable=False, default=30)
    confidence = Column(String(50), nullable=False, default="EXPLORATORY")
    metrics = Column(JSON, nullable=False, default=dict)
    forecast_data = Column(JSON, nullable=False, default=list)
    insights = Column(JSON, nullable=True, default=dict)
    warnings = Column(JSON, nullable=True, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    dataset = relationship("Dataset", backref="forecast_analyses")
