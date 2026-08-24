from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DecisionOutcomeCreate(BaseModel):
    """Payload for submitting a real-world observed decision outcome."""
    recommendation_id: str = Field(..., description="Target recommendation ID being measured")
    actual_metric: str = Field(..., description="Metric name of the observed real-world result")
    actual_value: float = Field(..., description="Observed real-world numerical value")
    notes: Optional[str] = Field(None, description="Optional notes regarding the measurement event")


class OutcomeEvaluation(BaseModel):
    """Deterministic comparative evaluation between expected model prediction and actual outcome."""
    expected_value: float = Field(..., description="Target metric prediction from optimization scenario")
    actual_value: float = Field(..., description="Observed real-world outcome value")
    absolute_error: float = Field(..., description="abs(actual_value - expected_value)")
    percentage_error: float = Field(..., description="Relative projection error percentage")
    achievement_percentage: float = Field(..., description="Objective-aware target achievement percentage")
    objective: str = Field(..., description="Optimization objective: maximize or minimize")
    outcome_status: str = Field(..., description="Status: ACHIEVED, PARTIALLY_ACHIEVED, NOT_ACHIEVED, INSUFFICIENT_DATA")


class DecisionOutcomeResponse(BaseModel):
    """Unified response representation for a recorded decision outcome."""
    id: str = Field(..., description="Unique outcome ID")
    dataset_id: str = Field(..., description="Dataset ID")
    recommendation_id: str = Field(..., description="Recommendation ID")
    optimization_id: str = Field(..., description="Optimization ID")
    scenario_id: Optional[str] = Field(None, description="Scenario ID")
    ml_analysis_id: str = Field(..., description="ML analysis ID")

    expected_metric: str = Field(..., description="Target metric column name")
    expected_value: float = Field(..., description="Expected model projection value")
    actual_metric: str = Field(..., description="Observed metric name")
    actual_value: float = Field(..., description="Observed metric value")

    absolute_error: float = Field(..., description="Absolute error")
    percentage_error: float = Field(..., description="Percentage error")
    achievement_percentage: float = Field(..., description="Achievement percentage")
    objective: str = Field(..., description="Objective: maximize or minimize")
    outcome_status: str = Field(..., description="Status: ACHIEVED, PARTIALLY_ACHIEVED, NOT_ACHIEVED")

    notes: Optional[str] = Field(None, description="Notes")
    recorded_at: datetime = Field(..., description="Timestamp when outcome was recorded")
    evaluated_at: datetime = Field(..., description="Timestamp when outcome was evaluated")


class DecisionMemoryItem(BaseModel):
    """Historical decision memory entry combining decision recommendation with measured outcome."""
    outcome_id: str = Field(..., description="Outcome record ID")
    recommendation_id: str = Field(..., description="Recommendation ID")
    recommendation_title: str = Field(..., description="Recommendation title")
    recommendation_type: str = Field(..., description="Recommendation type")
    target_metric: str = Field(..., description="Target metric column name")

    expected_value: float = Field(..., description="Model projected outcome")
    actual_value: float = Field(..., description="Observed actual outcome")
    achievement_percentage: float = Field(..., description="Achievement percentage")
    outcome_status: str = Field(..., description="Outcome classification status")
    decision_status: str = Field(..., description="Guardrail readiness status at recommendation time")
    confidence: str = Field(..., description="Recommendation confidence level")

    recorded_at: datetime = Field(..., description="Outcome recording timestamp")


class DecisionMemoryResponse(BaseModel):
    """Historical Decision Memory response collection for a dataset."""
    dataset_id: str = Field(..., description="Dataset ID")
    total_records: int = Field(..., description="Total recorded outcomes")
    history: List[DecisionMemoryItem] = Field(default_factory=list, description="Historical decision memory list")


class DecisionPerformanceSummary(BaseModel):
    """Aggregate statistical performance metrics for a dataset's historical decision memory."""
    dataset_id: str = Field(..., description="Dataset ID")
    total_decisions: int = Field(..., description="Total evaluated decision outcomes")
    achieved_count: int = Field(..., description="Count of ACHIEVED outcomes")
    partially_achieved_count: int = Field(..., description="Count of PARTIALLY_ACHIEVED outcomes")
    not_achieved_count: int = Field(..., description="Count of NOT_ACHIEVED outcomes")

    achievement_rate: float = Field(..., description="Percentage of decisions achieving >= 70% target (Achieved + Partially Achieved)")
    average_percentage_error: float = Field(..., description="Average projection error percentage across all outcomes")
    average_achievement_percentage: float = Field(..., description="Average target achievement percentage")
    limited_history_warning: Optional[str] = Field(None, description="Exploratory warning if decision count < 5")
