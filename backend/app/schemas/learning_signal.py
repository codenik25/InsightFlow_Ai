from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DecisionLearningSignalResponse(BaseModel):
    """Structured representation of a persistent Decision Learning & Improvement Signal."""
    id: str
    project_id: str
    signal_type: str = Field(
        ...,
        description="PREDICTION_DEVIATION | OUTCOME_DEVIATION | SCENARIO_DEVIATION | ASSUMPTION_CHANGE | DATA_DRIFT_RELEVANT | OUTCOME_COVERAGE_GAP | MODEL_PERFORMANCE_VARIANCE",
    )
    metric_name: Optional[str] = None

    source_outcome_ids: List[str] = Field(default_factory=list)
    source_decision_ids: List[str] = Field(default_factory=list)
    source_ml_analysis_ids: Optional[List[str]] = Field(default_factory=list)
    source_dataset_ids: Optional[List[str]] = Field(default_factory=list)
    source_dataset_versions: Optional[List[int]] = Field(default_factory=list)

    sample_count: int = 0
    observed_count: int = 0
    threshold_used: Optional[float] = 0.05

    severity: str = Field(..., description="INFO | REVIEW | HIGH")
    status: str = Field(..., description="NEW | ACKNOWLEDGED | INVESTIGATING | RESOLVED | DISMISSED")

    title: str
    description: str

    evidence_summary: Dict[str, Any] = Field(default_factory=dict)
    fingerprint: str

    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DecisionLearningSignalUpdate(BaseModel):
    """Payload for human analyst lifecycle transitions on a learning signal."""
    status: str = Field(..., description="NEW | ACKNOWLEDGED | INVESTIGATING | RESOLVED | DISMISSED")
    review_notes: Optional[str] = Field(None, description="Optional notes explaining human review or investigation action")
    reviewed_by: Optional[str] = Field(None, description="Identifier or name of human reviewer")


class DecisionLearningSignalsListResponse(BaseModel):
    """Project-scoped collection of Decision Learning & Improvement Signals with status/severity aggregates."""
    project_id: str
    total_signals: int
    by_severity: Dict[str, int] = Field(default_factory=dict)
    by_status: Dict[str, int] = Field(default_factory=dict)
    signals: List[DecisionLearningSignalResponse] = Field(default_factory=list)
