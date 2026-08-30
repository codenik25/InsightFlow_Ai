from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class EvaluationViolation(BaseModel):
    """Schema representing an individual violation found during AI evaluation."""
    dimension: str = Field(..., description="Evaluation dimension where violation occurred")
    rule: str = Field(..., description="Rule name or identifier")
    severity: str = Field("HIGH", description="Severity: HIGH, MEDIUM, LOW")
    message: str = Field(..., description="Description of violation")
    evidence_context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Context details")


class EvaluationMetricScore(BaseModel):
    """Score breakdown for a specific evaluation dimension."""
    dimension: str = Field(..., description="Dimension name")
    score: float = Field(..., description="Measured score (0.0 to 1.0)")
    status: str = Field(..., description="Status: PASS, FAIL, UNAVAILABLE")
    details: str = Field(..., description="Evaluation summary details")


class AIEvaluationRequest(BaseModel):
    """Request payload for running AI evaluation."""
    brief_id: Optional[str] = Field(None, description="Optional Decision Brief ID to evaluate")
    decision_id: Optional[str] = Field(None, description="Optional Decision ID")
    recommendation_id: Optional[str] = Field(None, description="Optional Recommendation ID")
    evaluation_version: Optional[str] = Field("v1", description="Evaluation ruleset version")


class AIEvaluationResponse(BaseModel):
    """Response returned upon completing AI evaluation."""
    id: str = Field(..., description="Evaluation record ID")
    dataset_id: str = Field(..., description="Dataset ID")
    decision_id: Optional[str] = Field(None, description="Decision ID")
    brief_id: Optional[str] = Field(None, description="Decision Brief ID")
    recommendation_id: Optional[str] = Field(None, description="Recommendation ID")
    evaluation_version: str = Field(..., description="Evaluation framework version")
    overall_status: str = Field(..., description="Overall status: PASS, FAIL, NEEDS_REVIEW")
    overall_score: float = Field(..., description="Transparent aggregate score from 0.0 to 1.0")
    dimension_scores: Dict[str, EvaluationMetricScore] = Field(default_factory=dict, description="Scores by dimension")
    violations: List[EvaluationViolation] = Field(default_factory=list, description="List of detected violations")
    evaluated_at: datetime = Field(..., description="Timestamp when evaluation was executed")
    created_at: datetime = Field(..., description="Record creation timestamp")
