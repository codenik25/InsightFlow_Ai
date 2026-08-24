from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RecommendationRequest(BaseModel):
    optimization_id: Optional[str] = Field(None, description="Target decision optimization ID (auto-selected if omitted)")
    max_recommendations: int = Field(3, ge=1, le=10, description="Maximum number of recommendations to generate")


class RecommendationEvidence(BaseModel):
    dataset_id: str = Field(..., description="Target dataset ID")
    ml_analysis_id: str = Field(..., description="ML Analysis ID")
    optimization_id: str = Field(..., description="Decision Optimization ID")
    scenario_id: Optional[str] = Field(None, description="Optimization Scenario ID")
    insight_ids: List[str] = Field(default_factory=list, description="Linked Phase 4 Business Insight IDs")


class DecisionRecommendation(BaseModel):
    id: str = Field(..., description="Unique recommendation ID")
    title: str = Field(..., description="Actionable title summary")
    recommendation_type: str = Field(..., description="Type (PERFORMANCE, EFFICIENCY, GROWTH, RISK_MITIGATION, DIVERSIFICATION, DATA_QUALITY)")
    priority: int = Field(..., description="Recommendation priority rank (1 = highest)")
    target_metric: str = Field(..., description="Target metric column")
    baseline_value: float = Field(..., description="Baseline prediction outcome")
    projected_value: float = Field(..., description="Projected scenario outcome")
    absolute_delta: float = Field(..., description="Absolute change vs baseline")
    percentage_delta: float = Field(..., description="Percentage change vs baseline")
    changed_features: Dict[str, Any] = Field(default_factory=dict, description="Feature adjustments made in scenario")
    rationale: str = Field(..., description="Deterministic evidence rationale")
    tradeoffs: str = Field(..., description="Operational trade-off analysis")
    confidence: str = Field(..., description="Confidence classification (EXPLORATORY, MODERATE, STRONG)")
    evidence: RecommendationEvidence = Field(..., description="Evidence provenance links")


class RecommendationResponse(BaseModel):
    dataset_id: str = Field(..., description="Target dataset ID")
    optimization_id: str = Field(..., description="Decision Optimization ID")
    recommendations: List[DecisionRecommendation] = Field(default_factory=list, description="List of decision recommendations")
    overall_confidence: str = Field("EXPLORATORY", description="Overall confidence level across recommendations")
    warning: Optional[str] = Field(None, description="Informational warning message")
    generated_at: str = Field(..., description="ISO timestamp")
