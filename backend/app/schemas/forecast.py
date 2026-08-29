from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ForecastPoint(BaseModel):
    date: str
    predicted_value: float
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None


class ForecastMetrics(BaseModel):
    mae: float
    rmse: float
    r2: Optional[float] = None
    mape: Optional[float] = None


class ForecastTaskCandidate(BaseModel):
    task_type: str = "time_series_forecasting"
    target_column: str
    time_column: str
    suitability_score: float
    reasons: List[str]
    warnings: List[str]


class ForecastTaskDiscoveryResponse(BaseModel):
    dataset_id: str
    candidate_tasks: List[ForecastTaskCandidate]
    message: str


class ForecastAnalyzeRequest(BaseModel):
    target_column: Optional[str] = None
    time_column: Optional[str] = None
    horizon: Optional[int] = 30


class ForecastPredictRequest(BaseModel):
    horizon: int = 30


class ForecastAnalysisResponse(BaseModel):
    forecast_id: str
    dataset_id: str
    target_column: str
    time_column: str
    horizon: int
    confidence: str = Field(description="EXPLORATORY | LIMITED | STANDARD")
    sample_size: int
    metrics: ForecastMetrics
    forecast: List[ForecastPoint]
    historical: Optional[List[Dict[str, Any]]] = None
    insights: Optional[Dict[str, Any]] = None
    warnings: List[str] = []
    created_at: Optional[str] = None
