from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AnomalyFeatureDeviation(BaseModel):
    feature: str
    observed_value: Any
    expected_mean: float
    std_dev: float
    deviation_zscore: float
    description: str


class AnomalyItem(BaseModel):
    row_id: int
    anomaly_score: float
    status: str = Field(description="ANOMALOUS | NORMAL")
    severity: str = Field(description="LOW | MEDIUM | HIGH")
    explanation: str
    feature_deviations: List[AnomalyFeatureDeviation] = []
    raw_values: Dict[str, Any] = {}


class AnomalyAnalyzeRequest(BaseModel):
    feature_columns: Optional[List[str]] = None
    contamination: Optional[float] = None


class AnomalyAnalysisResponse(BaseModel):
    anomaly_id: str
    dataset_id: str
    total_observations: int
    anomaly_count: int
    anomaly_rate: float
    high_severity_count: int
    confidence: str = Field(description="EXPLORATORY | LIMITED | STANDARD")
    sample_size: int
    feature_columns: List[str]
    anomalies: List[AnomalyItem]
    warnings: List[str] = []
    score_distribution: Dict[str, int] = {}
    created_at: Optional[str] = None
