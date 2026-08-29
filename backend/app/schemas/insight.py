from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class InsightEvidence(BaseModel):
    dimension: Optional[str] = None
    metric: Optional[str] = None
    top_value: Optional[Any] = None
    total_value: Optional[Any] = None
    contribution_percent: Optional[float] = None
    second_best_value: Optional[Any] = None
    comparison_diff: Optional[float] = None
    correlation: Optional[float] = None
    sample_size: Optional[int] = None
    quality_score_before: Optional[float] = None
    quality_score_after: Optional[float] = None
    details: Optional[Dict[str, Any]] = None


class Insight(BaseModel):
    id: str
    dataset_id: str
    category: str  # KPI, PERFORMANCE, TREND, COMPARISON, CORRELATION, DATA_QUALITY, ANOMALY, OPPORTUNITY
    severity: str  # INFO, POSITIVE, WARNING, CRITICAL
    title: str
    observation: str
    evidence: InsightEvidence
    explanation: Optional[str] = None
    recommendation: Optional[str] = None
    priority_score: float = 50.0
    confidence: float = 1.0
    source_column: Optional[str] = None
    dimension: Optional[str] = None
    metric_value: Optional[float] = None
    comparison_value: Optional[float] = None
    percentage_change: Optional[float] = None
    created_at: str

    # Extended business insight fields (Backward Compatible)
    group_id: Optional[str] = None
    is_grouped: bool = False
    supporting_insight_ids: List[str] = Field(default_factory=list)
    metrics_involved: List[str] = Field(default_factory=list)
    affected_dimension: Optional[str] = None
    affected_entity: Optional[str] = None
    business_impact: Optional[str] = "MEDIUM"  # HIGH, MEDIUM, LOW
    confidence_label: Optional[str] = "HIGH"  # HIGH, MEDIUM, LOW
    non_causal_notice: Optional[str] = None
    scoring_components: Optional[Dict[str, float]] = None



class InsightSummary(BaseModel):
    total: int
    critical_count: int
    warning_count: int
    positive_count: int
    info_count: int
    opportunity_count: int


class InsightResponse(BaseModel):
    dataset_id: str
    summary: InsightSummary
    insights: List[Insight] = Field(default_factory=list)
