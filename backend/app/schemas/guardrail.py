from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class GuardrailResult(BaseModel):
    """Result of an individual guardrail rule evaluation."""
    rule_id: str = Field(..., description="Unique rule identifier (e.g., RULE_RANGE_BOUNDS)")
    rule_name: str = Field(..., description="Human-readable rule name")
    category: str = Field(..., description="Rule category: RANGE, DATA_QUALITY, MODEL_CONFIDENCE, SAMPLE_SIZE, SCENARIO_CHANGE, FEATURE_STABILITY, BUSINESS_FEASIBILITY")
    status: str = Field(..., description="Evaluation status: PASS, WARNING, FAIL")
    severity: str = Field(..., description="Severity level: INFO, WARNING, CRITICAL")
    message: str = Field(..., description="Evaluation summary message")
    evidence: Dict[str, Any] = Field(default_factory=dict, description="Supporting metrics and evidence details")


class DecisionGuardrailResponse(BaseModel):
    """Response schema for decision recommendation guardrail evaluation."""
    id: str = Field(..., description="Unique evaluation ID")
    recommendation_id: str = Field(..., description="Target recommendation ID")
    dataset_id: str = Field(..., description="Dataset ID")
    ml_analysis_id: str = Field(..., description="ML Analysis ID")
    optimization_id: str = Field(..., description="Optimization ID")
    scenario_id: Optional[str] = Field(None, description="Scenario ID")

    # Guardrail Scores (0.0 to 100.0)
    feasibility_score: float = Field(..., description="Feasibility score (0-100)")
    realism_score: float = Field(..., description="Realism score (0-100)")
    risk_score: float = Field(..., description="Risk score (0-100)")
    confidence_score: float = Field(..., description="Confidence score (0-100)")
    decision_readiness_score: float = Field(..., description="Overall decision readiness score (0-100)")

    # Classifications
    feasibility_status: str = Field(..., description="Feasibility status: FEASIBLE, CAUTION, INFEASIBLE")
    risk_level: str = Field(..., description="Risk level: LOW, MEDIUM, HIGH")
    decision_status: str = Field(..., description="Decision readiness status: READY_TO_CONSIDER, HUMAN_REVIEW_REQUIRED, NOT_RECOMMENDED")

    # Categorized Rule Results
    guardrail_results: List[GuardrailResult] = Field(..., description="Complete list of rule evaluations")
    passed_rules: List[GuardrailResult] = Field(..., description="List of passed rules")
    warnings: List[GuardrailResult] = Field(..., description="List of warning rules")
    violated_rules: List[GuardrailResult] = Field(..., description="List of violated rules")
    explanation: str = Field(..., description="Executive narrative summary")

    created_at: datetime = Field(..., description="Timestamp of evaluation creation")


class GuardrailBatchResponse(BaseModel):
    """Response schema for evaluating all recommendations in a dataset."""
    dataset_id: str = Field(..., description="Dataset ID")
    recommendations_count: int = Field(..., description="Number of evaluated recommendations")
    evaluations: List[DecisionGuardrailResponse] = Field(..., description="List of guardrail evaluations")
    generated_at: datetime = Field(..., description="Timestamp of batch evaluation generation")
