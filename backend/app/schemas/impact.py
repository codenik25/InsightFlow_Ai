from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ImpactMeasurementCreate(BaseModel):
    """Payload for recording an Impact / Value Measurement."""
    recommendation_id: str = Field(..., description="Target recommendation ID")
    decision_id: Optional[str] = Field(None, description="Optional decision ID")
    outcome_id: Optional[str] = Field(None, description="Optional outcome record ID")
    metric_name: str = Field(..., description="Generic business metric name")
    objective: str = Field("maximize", description="Objective: maximize or minimize")
    baseline_value: Optional[float] = Field(0.0, description="Baseline metric value before decision")
    expected_value: Optional[float] = Field(None, description="Expected metric value after decision")
    actual_value: Optional[float] = Field(None, description="Actual observed metric value after decision")
    monetary_conversion_rate: Optional[float] = Field(None, description="Optional monetary multiplier per metric unit change")
    value_unit: Optional[str] = Field("metric_units", description="Unit of measurement or currency label")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional metadata")


class ImpactMeasurementResponse(BaseModel):
    """Response representation for an Impact / Value Measurement record."""
    id: str = Field(..., description="Impact measurement ID")
    dataset_id: str = Field(..., description="Dataset ID")
    decision_id: Optional[str] = Field(None, description="Decision ID")
    recommendation_id: str = Field(..., description="Recommendation ID")
    outcome_id: Optional[str] = Field(None, description="Outcome record ID")
    metric_name: str = Field(..., description="Metric name")
    objective: str = Field(..., description="Objective: maximize or minimize")
    baseline_value: Optional[float] = Field(None, description="Baseline value")
    expected_value: Optional[float] = Field(None, description="Expected value")
    actual_value: Optional[float] = Field(None, description="Actual value")
    expected_change: float = Field(..., description="Expected metric change relative to baseline")
    actual_change: float = Field(..., description="Actual metric change relative to baseline")
    variance: float = Field(..., description="Variance between actual change and expected change")
    achievement_percentage: float = Field(..., description="Objective-aware achievement percentage")
    status: str = Field(..., description="Measurement status: ACHIEVED, PARTIALLY_ACHIEVED, NOT_ACHIEVED, UNMEASURABLE")
    value_created: Optional[float] = Field(None, description="Calculated value created")
    value_unit: Optional[str] = Field(None, description="Unit label")
    monetary_conversion_rate: Optional[float] = Field(None, description="Monetary conversion multiplier applied if provided")
    measured_at: datetime = Field(..., description="Timestamp of measurement")
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadata dictionary")


class ImpactSummaryResponse(BaseModel):
    """Aggregate Impact / Value Measurement summary for a dataset."""
    dataset_id: str = Field(..., description="Dataset ID")
    total_measurements: int = Field(..., description="Total measurement records")
    achieved_count: int = Field(..., description="Achieved count")
    partially_achieved_count: int = Field(..., description="Partially achieved count")
    not_achieved_count: int = Field(..., description="Not achieved count")
    unmeasurable_count: int = Field(..., description="Unmeasurable count")
    total_value_created: Optional[float] = Field(None, description="Summed value created across measurements")
    measurements: List[ImpactMeasurementResponse] = Field(default_factory=list, description="List of impact measurements")
