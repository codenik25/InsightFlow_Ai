from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ScenarioCreateRequest(BaseModel):
    name: str = Field(..., description="Human-readable scenario name")
    description: Optional[str] = Field(None, description="Optional description of simulation context")
    ml_analysis_id: Optional[str] = Field(None, description="Target ML analysis ID (auto-selected if omitted)")
    feature_changes: Dict[str, Any] = Field(
        ...,
        description="Dictionary of feature delta overrides or absolute values to simulate",
        json_schema_extra={
            "example": {
                "name": "Price & Volume Simulation",
                "description": "Simulate outcome of increasing unit price and sales volume",
                "feature_changes": {
                    "units_sold": 10,
                    "unit_price": 3000
                }
            }
        }
    )


class ScenarioResponse(BaseModel):
    id: str
    dataset_id: str
    ml_analysis_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    target_column: str
    base_value: float
    feature_changes: Dict[str, Any] = Field(default_factory=dict)
    predicted_outcome: float
    predicted_delta: float
    predicted_delta_percentage: float
    confidence_score: float
    feature_importances: Dict[str, float] = Field(default_factory=dict)
    feature_contributions: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class MLExplanationResponse(BaseModel):
    analysis_id: str
    dataset_id: str
    model_name: str
    model_version: str
    task_type: str
    target_column: str
    feature_columns: List[str] = Field(default_factory=list)
    feature_importances: Dict[str, float] = Field(default_factory=dict)
    explanation_summary: str


class ScenarioComparisonResponse(BaseModel):
    dataset_id: str
    ml_analysis_id: str
    target_column: str
    baseline_record: Dict[str, Any] = Field(default_factory=dict)
    baseline_prediction: float
    scenario_name: str
    scenario_changes: Dict[str, Any] = Field(default_factory=dict)
    scenario_prediction: float
    predicted_delta: float
    predicted_delta_percentage: float
    feature_importances: Dict[str, float] = Field(default_factory=dict)
    feature_contributions: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


class DecisionRecommendationResponse(BaseModel):
    id: str
    dataset_id: str
    scenario_id: Optional[str] = None
    ml_analysis_id: Optional[str] = None
    insight_id: Optional[str] = None
    title: str
    recommendation_type: str  # optimization, risk_mitigation, action
    impact_level: str  # high, medium, low
    expected_impact: str
    action_items: List[str] = Field(default_factory=list)
    evidence_traceability: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class DecisionSummaryResponse(BaseModel):
    dataset_id: str
    is_processed: bool
    scenarios: List[ScenarioResponse] = Field(default_factory=list)
    recommendations: List[DecisionRecommendationResponse] = Field(default_factory=list)
    message: Optional[str] = None
