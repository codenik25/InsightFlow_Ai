import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class DecisionImpactMeasurement(Base):
    """ORM Model for tracking and evaluating decision impact and value creation."""
    __tablename__ = "decision_impact_measurements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    decision_id = Column(String(255), nullable=True, index=True)
    recommendation_id = Column(String(255), nullable=False, index=True)
    outcome_id = Column(String(36), ForeignKey("decision_outcomes.id", ondelete="SET NULL"), nullable=True, index=True)

    metric_name = Column(String(255), nullable=False)
    objective = Column(String(50), nullable=False, default="maximize")

    baseline_value = Column(Float, nullable=True, default=0.0)
    expected_value = Column(Float, nullable=True)
    actual_value = Column(Float, nullable=True)

    expected_change = Column(Float, nullable=False, default=0.0)
    actual_change = Column(Float, nullable=False, default=0.0)
    variance = Column(Float, nullable=False, default=0.0)
    achievement_percentage = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), nullable=False, default="MEASURED", index=True)

    value_created = Column(Float, nullable=True)
    value_unit = Column(String(50), nullable=True, default="metric_units")
    monetary_conversion_rate = Column(Float, nullable=True)

    measured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    metadata_json = Column(JSON, nullable=True, default=dict)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    dataset = relationship("Dataset", backref="impact_measurements")
    outcome = relationship("DecisionOutcome", backref="impact_measurements")
