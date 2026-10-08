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
    optimization_id: Optional[str] = Field(None, description="Optimization ID")
    scenario_id: Optional[str] = Field(None, description="Scenario ID")
    ml_analysis_id: Optional[str] = Field(None, description="ML analysis ID")

    expected_metric: str = Field(..., description="Target metric column name")
    expected_value: float = Field(..., description="Expected model projection value")
    actual_metric: Optional[str] = Field(None, description="Observed metric name")
    actual_value: Optional[float] = Field(None, description="Observed metric value")

    absolute_error: Optional[float] = Field(None, description="Absolute error")
    percentage_error: Optional[float] = Field(None, description="Percentage error")
    achievement_percentage: Optional[float] = Field(None, description="Achievement percentage")
    objective: str = Field(..., description="Objective: maximize or minimize")
    outcome_status: str = Field(..., description="Status")

    notes: Optional[str] = Field(None, description="Notes")
    recorded_at: Optional[datetime] = Field(None, description="Timestamp when outcome was recorded")
    evaluated_at: Optional[datetime] = Field(None, description="Timestamp when outcome was evaluated")


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


# =====================================================================
# Phase 6: Decision Outcome & Learning Loop Schemas
# =====================================================================

class DecisionOutcomeCreatePhase6(BaseModel):
    """Payload for submitting or recording an observed decision outcome in Phase 6."""
    actual_metric: Optional[str] = Field(None, description="Observed metric name (defaults to expected metric if omitted)")
    actual_value: Optional[float] = Field(None, description="Observed real-world numerical value")
    source_dataset_id: Optional[str] = Field(None, description="Dataset ID where actual value was measured")
    source_dataset_version: Optional[int] = Field(None, description="Dataset version where actual value was measured")
    source_analysis_run_id: Optional[str] = Field(None, description="Analysis run ID associated with the measurement")
    material_difference_threshold: Optional[float] = Field(0.05, description="Relative difference threshold for material deviation (default 0.05 / 5%)")
    notes: Optional[str] = Field(None, description="Optional factual context or measurement notes")


class DecisionOutcomeFromVersionRequest(BaseModel):
    """Payload for safely measuring an actual outcome from a subsequent dataset version in the lineage."""
    target_dataset_id: Optional[str] = Field(None, description="Subsequent dataset version ID in same lineage")
    source_dataset_id: Optional[str] = Field(None, description="Alias for target_dataset_id")
    metric_column: Optional[str] = Field(None, description="Metric column name to aggregate from subsequent version")
    metric_name: Optional[str] = Field(None, description="Alias for metric_column")
    aggregation_method: Optional[str] = Field("mean", description="Aggregation method: mean, sum, median, latest")
    material_difference_threshold: Optional[float] = Field(0.05, description="Threshold for material difference (default 0.05)")
    notes: Optional[str] = Field(None, description="Optional measurement notes")


class DecisionOutcomeResponsePhase6(BaseModel):
    """Comprehensive decision outcome record with factual evaluation and learning signal."""
    id: str = Field(..., description="Unique outcome record ID")
    project_id: Optional[str] = Field(None, description="Project ID")
    decision_id: str = Field(..., description="Decision identifier")
    recommendation_id: Optional[str] = Field(None, description="Associated recommendation ID")
    dataset_id: str = Field(..., description="Dataset ID on which decision was formed")

    expected_metric: str = Field(..., description="Expected target metric name")
    expected_value: float = Field(..., description="Expected baseline or scenario prediction value")

    actual_metric: Optional[str] = Field(None, description="Actual observed metric name")
    actual_value: Optional[float] = Field(None, description="Actual observed numerical value")

    absolute_delta: Optional[float] = Field(None, description="actual_value - expected_value")
    relative_delta: Optional[float] = Field(None, description="(actual_value - expected_value) / expected_value")
    threshold_used: float = Field(0.05, description="Material difference threshold used for evaluation")

    outcome_status: str = Field(..., description="Factual outcome state: PENDING, OBSERVED, MATCHED, DIFFERED, MATERIALLY_DIFFERED")
    learning_signal: str = Field(..., description="Factual learning signal: PREDICTION_ACCURACY, OUTCOME_DEVIATION, SCENARIO_DEVIATION, ASSUMPTION_CHANGE, DATA_DRIFT_RELEVANT, UNAVAILABLE")
    learning_summary: str = Field(..., description="Factual summary text explaining outcome variance without causal speculation")

    source_dataset_id: Optional[str] = Field(None, description="Source dataset ID where actual was observed")
    source_dataset_version: Optional[int] = Field(None, description="Source dataset version number")
    source_dataset_name: Optional[str] = Field(None, description="Source dataset name")
    source_analysis_run_id: Optional[str] = Field(None, description="Source analysis run ID")

    notes: Optional[str] = Field(None, description="Notes")
    recorded_at: Optional[datetime] = Field(None, description="Timestamp when actual outcome was recorded")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record update timestamp")


class DecisionOutcomesListResponse(BaseModel):
    """List of all recorded and historical outcomes for a decision."""
    decision_id: str = Field(..., description="Decision identifier")
    project_id: Optional[str] = Field(None, description="Project ID")
    dataset_id: str = Field(..., description="Dataset ID")
    expected_metric: str = Field("target", description="Expected metric name")
    expected_value: float = Field(0.0, description="Expected prediction value")
    threshold_used: float = Field(0.05, description="Material difference threshold")
    current_status: str = Field(..., description="Current factual status: PENDING, OBSERVED, MATCHED, DIFFERED, MATERIALLY_DIFFERED")
    learning_signal: str = Field(..., description="Current learning signal")
    learning_summary: Optional[str] = Field(None, description="Empirical summary text")
    total_outcomes: int = Field(0, description="Total outcomes recorded for this decision")
    outcomes_count: int = Field(0, description="Total outcomes recorded for this decision")
    primary_outcome: Optional[DecisionOutcomeResponsePhase6] = Field(None, description="Latest or primary outcome record")
    latest_outcome: Optional[DecisionOutcomeResponsePhase6] = Field(None, description="Latest outcome record (null if pending)")
    history: List[DecisionOutcomeResponsePhase6] = Field(default_factory=list, description="Chronological outcome history")

