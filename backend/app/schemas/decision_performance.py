from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class PerformanceSummary(BaseModel):
    """Aggregate summary metrics for decision performance intelligence."""
    total_decisions: int = Field(..., description="Total decisions tracked in the project")
    decisions_with_decision_records: int = Field(..., description="Denominator for outcome coverage")
    decisions_with_outcomes: int = Field(..., description="Decisions with observed real-world outcomes")
    decisions_with_actual_outcomes: int = Field(..., description="Numerator for outcome coverage")
    pending_outcomes: int = Field(..., description="Decisions awaiting observed actual outcome")
    matched_outcomes: int = Field(..., description="Observed outcomes within match tolerance (<= 1%)")
    differed_outcomes: int = Field(..., description="Observed outcomes differing but within threshold")
    materially_differed_outcomes: int = Field(..., description="Observed outcomes exceeding material threshold")
    outcome_coverage_rate: float = Field(..., description="Fraction of decisions with observed outcomes (0.0 - 1.0)")
    match_rate: float = Field(..., description="Outcome match rate across observed decisions (0.0 - 1.0)")
    material_difference_rate: float = Field(..., description="Fraction of observed decisions with material difference (0.0 - 1.0)")
    average_absolute_delta: Optional[float] = Field(None, description="Mean of absolute deltas across observed outcomes")
    average_relative_delta: Optional[float] = Field(None, description="Mean of relative deltas across observed outcomes")
    median_relative_delta: Optional[float] = Field(None, description="Median of relative deltas across observed outcomes")


class MetricPerformanceItem(BaseModel):
    """Outcome performance breakdown for an individual metric."""
    metric_name: str
    total_decisions: int
    observed_outcomes: int
    pending_outcomes: int
    matched_outcomes: int
    differed_outcomes: int
    material_deviations: int
    mean_relative_delta: Optional[float] = None
    median_relative_delta: Optional[float] = None
    mean_absolute_delta: Optional[float] = None
    min_relative_delta: Optional[float] = None
    max_relative_delta: Optional[float] = None
    match_rate: float
    material_difference_rate: float
    status: str = Field(..., description="NO_OUTCOMES | LIMITED_OBSERVATIONS | STABLE_RANGE | MATERIAL_DEVIATION | REPEATED_DEVIATION | OBSERVED")
    source_outcome_ids: List[str] = Field(default_factory=list)


class TrendPeriodItem(BaseModel):
    """Chronological aggregation bucket for decision outcomes."""
    period_start: str
    period_label: str
    observed_outcomes: int
    average_relative_delta: Optional[float] = None
    material_deviations: int
    matched_outcomes: int
    differed_outcomes: int
    status: str = Field(..., description="OBSERVED | INSUFFICIENT_OBSERVATIONS")


class LearningSignalsAggregation(BaseModel):
    """Aggregation of Phase 6 learning signals."""
    prediction_accuracy: int = 0
    outcome_deviation: int = 0
    scenario_deviation: int = 0
    assumption_change: int = 0
    data_drift_relevant: int = 0
    unavailable: int = 0
    total_signals: int = 0


class RepeatedDeviationFinding(BaseModel):
    """Factual recurring material deviation pattern."""
    finding_type: str = "REPEATED_OUTCOME_DEVIATION"
    metric_name: str
    statement: str
    sample_count: int
    observed_count: int
    material_deviation_count: int
    deviation_rate: float
    threshold_used: float
    time_range: Dict[str, Optional[str]]
    source_outcome_ids: List[str] = Field(default_factory=list)


class ModelPerformanceItem(BaseModel):
    """Model-level metrics computed strictly when explicitly linked to an ML Analysis."""
    ml_analysis_id: str
    model_name: str
    target_column: str
    task_type: Optional[str] = None
    observed_outcomes: int
    mean_absolute_error: Optional[float] = None
    mean_relative_error: Optional[float] = None
    material_deviations: int
    source_outcome_ids: List[str] = Field(default_factory=list)


class ScenarioPerformanceItem(BaseModel):
    """Scenario-level outcome performance."""
    scenario_id: str
    scenario_name: str
    target_metric: str
    total_decisions: int
    observed_outcomes: int
    mean_relative_delta: Optional[float] = None
    material_deviations: int
    matched_outcomes: int
    source_outcome_ids: List[str] = Field(default_factory=list)


class DecisionPerformanceResponse(BaseModel):
    """Comprehensive analytical response for Decision Performance Intelligence."""
    project_id: str
    project_name: Optional[str] = None
    status: str = Field(..., description="NO_DECISION_DATA | NO_OBSERVED_OUTCOMES | INSUFFICIENT_OBSERVATIONS | OBSERVED")
    summary: PerformanceSummary
    metrics: List[MetricPerformanceItem] = Field(default_factory=list)
    trends: List[TrendPeriodItem] = Field(default_factory=list)
    signals: LearningSignalsAggregation = Field(default_factory=LearningSignalsAggregation)
    observations: List[RepeatedDeviationFinding] = Field(default_factory=list)
    models: List[ModelPerformanceItem] = Field(default_factory=list)
    scenarios: List[ScenarioPerformanceItem] = Field(default_factory=list)
    min_observations_used: int = 3
    threshold_used: float = 0.05
