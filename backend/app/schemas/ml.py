from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


TaskTypeEnum = Literal["regression", "classification", "time_series_forecasting", "anomaly_detection"]


class MLTaskCandidate(BaseModel):
    task_type: TaskTypeEnum
    target_column: Optional[str] = None
    suitability_score: float = Field(..., ge=0.0, le=1.0)
    reasons: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    required_conditions: List[str] = Field(default_factory=list)


class MLTaskDiscoveryResponse(BaseModel):
    dataset_id: str
    is_processed: bool
    candidate_tasks: List[MLTaskCandidate] = Field(default_factory=list)
    message: Optional[str] = None


class MLFeatureInfo(BaseModel):
    name: str
    role: str  # numeric, categorical, datetime, identifier, text
    status: Literal["included", "excluded"]
    reason: str


class MLModelMetrics(BaseModel):
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2: Optional[float] = None
    mape: Optional[float] = None
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    anomaly_count: Optional[int] = None
    anomaly_percentage: Optional[float] = None


class MLModelCandidate(BaseModel):
    model_name: str
    metrics: Dict[str, Optional[float]] = Field(default_factory=dict)
    is_selected: bool = False
    selection_reason: str = ""


class MLAnalysisRequest(BaseModel):
    task_type: Optional[str] = None
    target_column: Optional[str] = None
    datetime_column: Optional[str] = None


class MLAnalysisResponse(BaseModel):
    id: str
    dataset_id: str
    task_type: str
    target_column: Optional[str] = None
    feature_summary: List[MLFeatureInfo] = Field(default_factory=list)
    feature_columns: List[str] = Field(default_factory=list)
    model_name: str
    model_version: str = "1.0"
    training_row_count: int
    test_row_count: int
    metrics: Dict[str, Optional[float]] = Field(default_factory=dict)
    candidate_models: List[MLModelCandidate] = Field(default_factory=list)
    status: str = "completed"
    selection_reason: str = ""
    data_warnings: List[str] = Field(default_factory=list)
    model_artifact_path: Optional[str] = None
    created_at: str


class PredictionRequest(BaseModel):
    inputs: List[Dict[str, Any]] = Field(
        ...,
        description="List of feature dictionary inputs to run predictions on",
        json_schema_extra={
            "example": {
                "inputs": [
                    {
                        "units_sold": 5,
                        "unit_price": 2500,
                        "category": "Accessories",
                        "region": "Mumbai"
                    }
                ]
            }
        }
    )



class PredictionResponse(BaseModel):
    analysis_id: str
    task_type: str
    target_column: Optional[str] = None
    predictions: List[Any] = Field(default_factory=list)
    probabilities: Optional[List[Dict[str, float]]] = None
    explanation: str = ""
