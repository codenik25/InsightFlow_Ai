from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DecisionSnapshot(BaseModel):
    """Core metric snapshot of decision readiness and risk profile."""
    decision_readiness_score: float = Field(..., description="Overall decision readiness score (0-100)")
    decision_status: str = Field(..., description="Decision readiness status: READY_TO_CONSIDER, HUMAN_REVIEW_REQUIRED, NOT_RECOMMENDED")
    feasibility_score: float = Field(..., description="Feasibility score (0-100)")
    realism_score: float = Field(..., description="Realism score (0-100)")
    risk_score: float = Field(..., description="Risk score (0-100)")
    confidence_score: float = Field(..., description="Confidence score (0-100)")
    dataset_quality_score: float = Field(..., description="Dataset quality completeness score (0-100)")
    sample_size: int = Field(..., description="Total rows in processed dataset")
    small_dataset_warning: Optional[str] = Field(None, description="Explicit warning if sample size < 30 rows")


class DecisionRecommendationSummary(BaseModel):
    """Summary representation of a decision recommendation for the Command Center."""
    recommendation_id: str = Field(..., description="Unique recommendation ID")
    priority: int = Field(..., description="Priority rank (1 = highest)")
    recommendation_type: str = Field(..., description="Recommendation type: PERFORMANCE, EFFICIENCY, GROWTH, RISK_MITIGATION, DIVERSIFICATION")
    title: str = Field(..., description="Recommendation title")
    target_metric: str = Field(..., description="Target metric column name")
    baseline_value: Optional[float] = Field(None, description="Baseline target metric prediction")
    projected_value: Optional[float] = Field(None, description="Projected target metric outcome")
    absolute_delta: Optional[float] = Field(None, description="Absolute projected change")
    percentage_delta: Optional[float] = Field(None, description="Percentage projected change")
    confidence: str = Field(..., description="Confidence level: EXPLORATORY, MODERATE, STRONG")
    decision_status: str = Field(..., description="Guardrail decision status")


class EvidenceNode(BaseModel):
    """Individual node in the evidence provenance chain."""
    node_type: str = Field(..., description="Node type: RECOMMENDATION, OPTIMIZATION, SCENARIO, ML_ANALYSIS, INSIGHT, GUARDRAIL")
    node_id: str = Field(..., description="ID of the referenced entity")
    title: str = Field(..., description="Title or summary name of the node")
    description: str = Field(..., description="Detailed description of the evidence node")


class EvidenceChain(BaseModel):
    """Complete provenance chain linking recommendation to upstream analytical evidence."""
    recommendation_id: str = Field(..., description="Target recommendation ID")
    optimization_id: Optional[str] = Field(None, description="Linked optimization ID")
    scenario_id: Optional[str] = Field(None, description="Linked scenario ID")
    ml_analysis_id: Optional[str] = Field(None, description="Linked ML analysis ID")
    insight_ids: List[str] = Field(default_factory=list, description="Linked Phase 4 insight IDs")
    guardrail_id: Optional[str] = Field(None, description="Linked guardrail evaluation ID")
    nodes: List[EvidenceNode] = Field(default_factory=list, description="Sequential evidence nodes list")


class DecisionComparison(BaseModel):
    """Feature-level comparison between historical baseline and proposed recommendation."""
    feature: str = Field(..., description="Feature column name")
    baseline_value: Any = Field(..., description="Historical baseline feature value")
    proposed_value: Any = Field(..., description="Proposed feature value under recommendation")
    delta: Optional[float] = Field(None, description="Numeric delta displacement where applicable")
    contribution_percent: Optional[float] = Field(None, description="Feature contribution or importances percentage")


class RiskSummary(BaseModel):
    """Aggregated risk profile and guardrail audit breakdown."""
    risk_level: str = Field(..., description="Risk level: LOW, MEDIUM, HIGH")
    warnings: List[str] = Field(default_factory=list, description="List of warning messages")
    failed_rules: List[str] = Field(default_factory=list, description="List of failed rule messages")
    passed_rules: List[str] = Field(default_factory=list, description="List of passed rule names")


class DecisionCommandCenterResponse(BaseModel):
    """Unified response schema for the Decision Intelligence Command Center."""
    dataset_id: str = Field(..., description="Requested dataset ID")
    processed_dataset_id: str = Field(..., description="Resolved processed dataset ID")
    dataset_name: str = Field(..., description="Dataset name")
    generated_at: datetime = Field(..., description="Timestamp of command center aggregation")

    snapshot: DecisionSnapshot = Field(..., description="Executive decision readiness snapshot")
    primary_recommendation: Optional[DecisionRecommendationSummary] = Field(None, description="Priority #1 decision recommendation")
    alternative_recommendations: List[DecisionRecommendationSummary] = Field(default_factory=list, description="Alternative recommendations")
    comparison: List[DecisionComparison] = Field(default_factory=list, description="Feature adjustment comparison matrix")
    risk_summary: RiskSummary = Field(..., description="Aggregated risk & guardrail summary")
    evidence_chain: Optional[EvidenceChain] = Field(None, description="Complete evidence provenance chain for primary recommendation")
    key_insights: List[Dict[str, Any]] = Field(default_factory=list, description="Supporting Phase 4 business insights")
    next_actions: List[str] = Field(default_factory=list, description="Deterministic executive next action steps")
