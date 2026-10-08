from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class PortfolioSummaryKPIs(BaseModel):
    """Factual aggregate counts across the project's decision population."""
    total_decisions: int = Field(default=0, description="Total distinct decisions in this project")
    decisions_under_review: int = Field(default=0, description="Decisions currently in review or draft")
    pending_approval: int = Field(default=0, description="Decisions awaiting governance approval")
    approved: int = Field(default=0, description="Decisions approved by governance")
    rejected: int = Field(default=0, description="Decisions rejected by governance")
    escalated: int = Field(default=0, description="Decisions escalated by governance")
    on_hold: int = Field(default=0, description="Decisions placed on hold")
    executed: int = Field(default=0, description="Decisions with completed execution record")
    not_executed: int = Field(default=0, description="Decisions marked not executed / cancelled")
    closed: int = Field(default=0, description="Decisions fully closed")
    outcome_monitoring: int = Field(default=0, description="Decisions actively in closed-loop outcome monitoring")
    decisions_with_observed_outcomes: int = Field(default=0, description="Decisions with empirical real-world outcome recorded")
    decisions_with_pending_outcomes: int = Field(default=0, description="Decisions awaiting outcome measurement")
    decisions_with_active_learning_signals: int = Field(default=0, description="Decisions associated with unresolved Phase 8 signals")
    decisions_with_execution_failures: int = Field(default=0, description="Decisions with execution failure recorded")


class GovernanceDistributionItem(BaseModel):
    """Factual distribution count and percentage for a governance state."""
    status: str
    count: int
    percentage: float


class ExecutionDistributionItem(BaseModel):
    """Factual distribution count and percentage for an execution state."""
    status: str
    count: int
    percentage: float


class OutcomeDistributionItem(BaseModel):
    """Factual distribution count and percentage for an empirical outcome state."""
    status: str
    count: int
    percentage: float


class CrossDecisionMetricItem(BaseModel):
    """Cross-decision metric presence and outcome statistics."""
    metric_name: str
    decisions_count: int
    observed_outcomes_count: int
    material_deviations_count: int
    decision_ids: List[str] = Field(default_factory=list)


class PortfolioRecurringDeviation(BaseModel):
    """Empirical recurring deviation finding supported by multiple observations."""
    metric_name: str
    decision_ids: List[str] = Field(default_factory=list)
    observed_outcomes_count: int
    material_deviations_count: int
    description: str
    source_outcome_ids: List[str] = Field(default_factory=list)
    source_signal_ids: List[str] = Field(default_factory=list)


class PortfolioSignalSummary(BaseModel):
    """Active Phase 8 learning signal breakdown across the portfolio."""
    total_active_signals: int = 0
    high_count: int = 0
    review_count: int = 0
    info_count: int = 0
    by_type: Dict[str, int] = Field(default_factory=dict)
    unresolved_signal_decisions: List[str] = Field(default_factory=list)


class ExecutionFailureFinding(BaseModel):
    """Factual record of an execution failure with persisted details."""
    decision_id: str
    execution_id: str
    failure_reason: str
    occurred_at: Optional[datetime] = None
    similarity_group: Optional[str] = None


class PortfolioTrendPeriod(BaseModel):
    """Time-bucketed trend item for decision lifecycle metrics."""
    period_start: str
    period_label: str
    decisions_created: int = 0
    approvals_count: int = 0
    executions_count: int = 0
    observed_outcomes_count: int = 0
    learning_signals_count: int = 0
    execution_failures_count: int = 0


class DecisionDependencyItem(BaseModel):
    """Explicit shared relationship between two or more decisions."""
    entity_type: str  # DATASET_VERSION, SCENARIO, ML_MODEL, METRIC, ANALYSIS_RUN
    entity_id: str
    entity_label: str
    decision_count: int
    decision_ids: List[str] = Field(default_factory=list)


class DecisionClusterItem(BaseModel):
    """Factual cluster of decisions grouped by shared persisted attributes."""
    cluster_name: str
    shared_attribute_type: str
    shared_attribute_value: str
    decision_count: int
    decision_ids: List[str] = Field(default_factory=list)
    evidence_summary: Dict[str, Any] = Field(default_factory=dict)


class PortfolioDecisionRow(BaseModel):
    """Inventory item for a single decision within the project portfolio."""
    decision_id: str
    recommendation_id: Optional[str] = None
    dataset_id: str
    dataset_name: Optional[str] = None
    metric: Optional[str] = None
    governance_status: str = "DRAFT"
    execution_status: Optional[str] = None
    outcome_status: str = "PENDING"
    active_signals_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PortfolioConcentrationItem(BaseModel):
    """Descriptive count of decisions for a specific category or attribute."""
    key: str
    label: str
    decision_count: int


class PortfolioDependencyExposure(BaseModel):
    """Factual advisory and decision linkage for shared explicit dependencies."""
    dependency_type: str  # DATASET_VERSION, SCENARIO, ML_MODEL, METRIC
    dependency_id: str
    label: str
    decision_count: int
    decision_ids: List[str] = Field(default_factory=list)
    advisory: str


class PortfolioOperationsSummary(BaseModel):
    """Compact summary of operational lifecycle states across the portfolio."""
    pending_approval: int = 0
    pending_confirmation: int = 0
    executing: int = 0
    outcome_monitoring: int = 0
    execution_failed: int = 0
    pending_outcomes: int = 0
    active_learning_signals: int = 0


class PortfolioBottleneckItem(BaseModel):
    """Factual operational bottleneck indicator derived from lifecycle states."""
    indicator: str
    count: int
    description: str


class PortfolioCapacityIndicators(BaseModel):
    """Factual workload indicators derived from persisted execution records."""
    pending_confirmations: int = 0
    currently_executing: int = 0
    execution_failures: int = 0
    outcome_monitoring: int = 0
    executions_completed: int = 0
    avg_execution_duration_seconds: Optional[float] = None


class PortfolioExposureIndicators(BaseModel):
    """Factual aggregated active exposure counts across unresolved signals and outcomes."""
    decisions_with_active_learning_signals: int = 0
    decisions_awaiting_outcomes: int = 0
    decisions_with_material_deviations: int = 0
    decisions_with_execution_failures: int = 0


class PortfolioCapacityResponse(BaseModel):
    """Phase 12 Portfolio Risk, Capacity & Dependency Intelligence response."""
    project_id: str
    operations: PortfolioOperationsSummary
    bottlenecks: List[PortfolioBottleneckItem] = Field(default_factory=list)
    capacity_indicators: PortfolioCapacityIndicators
    exposure_indicators: PortfolioExposureIndicators
    concentration: Dict[str, List[PortfolioConcentrationItem]] = Field(default_factory=dict)
    dependencies: List[PortfolioDependencyExposure] = Field(default_factory=list)


class DecisionPortfolioOverviewResponse(BaseModel):
    """Complete Decision Portfolio & Cross-Decision Intelligence response."""
    project_id: str
    project_name: Optional[str] = None
    last_updated: Optional[datetime] = None
    kpis: PortfolioSummaryKPIs
    governance_distribution: List[GovernanceDistributionItem] = Field(default_factory=list)
    execution_distribution: List[ExecutionDistributionItem] = Field(default_factory=list)
    outcome_distribution: List[OutcomeDistributionItem] = Field(default_factory=list)
    metrics_patterns: List[CrossDecisionMetricItem] = Field(default_factory=list)
    recurring_deviations: List[PortfolioRecurringDeviation] = Field(default_factory=list)
    learning_signals_summary: PortfolioSignalSummary
    execution_failures: List[ExecutionFailureFinding] = Field(default_factory=list)
    dependencies: List[DecisionDependencyItem] = Field(default_factory=list)
    clusters: List[DecisionClusterItem] = Field(default_factory=list)
    decisions: List[PortfolioDecisionRow] = Field(default_factory=list)
    total_decisions_count: int = 0
    portfolio_operations: Optional[PortfolioOperationsSummary] = None
    capacity: Optional[PortfolioCapacityResponse] = None



class DecisionPortfolioTrendsResponse(BaseModel):
    """Time-series trend response."""
    project_id: str
    period: str  # day, week, month
    trends: List[PortfolioTrendPeriod] = Field(default_factory=list)


class DecisionPortfolioMetricsResponse(BaseModel):
    """Metric cross-decision response."""
    project_id: str
    metrics: List[CrossDecisionMetricItem] = Field(default_factory=list)
    recurring_deviations: List[PortfolioRecurringDeviation] = Field(default_factory=list)


class DecisionPortfolioSignalsResponse(BaseModel):
    """Learning signal portfolio response."""
    project_id: str
    summary: PortfolioSignalSummary


class DecisionPortfolioDependenciesResponse(BaseModel):
    """Explicit decision dependencies and clusters response."""
    project_id: str
    dependencies: List[DecisionDependencyItem] = Field(default_factory=list)
    clusters: List[DecisionClusterItem] = Field(default_factory=list)
