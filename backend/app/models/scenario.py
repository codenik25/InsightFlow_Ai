import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class Scenario(Base):
    """ORM Model for what-if scenario simulations and predictive parameters."""
    __tablename__ = "scenarios"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    ml_analysis_id = Column(String(36), ForeignKey("ml_analyses.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    target_column = Column(String(255), nullable=False)
    base_value = Column(Float, nullable=False, default=0.0)
    feature_changes = Column(JSON, nullable=False, default=dict)
    predicted_outcome = Column(Float, nullable=False, default=0.0)
    predicted_delta = Column(Float, nullable=False, default=0.0)
    predicted_delta_percentage = Column(Float, nullable=False, default=0.0)
    confidence_score = Column(Float, nullable=False, default=0.85)
    metadata_json = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    dataset = relationship("Dataset", backref="scenarios")
    ml_analysis = relationship("MLAnalysis", backref="scenarios")
