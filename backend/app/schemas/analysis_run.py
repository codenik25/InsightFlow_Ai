from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class AnalysisRunBase(BaseModel):
    project_id: Optional[str] = None
    dataset_id: str
    dataset_version: int
    processed_dataset_id: Optional[str] = None
    run_type: str
    status: str
    configuration: Optional[Dict[str, Any]] = None
    input_artifacts: Optional[Dict[str, Any]] = None
    output_artifacts: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class AnalysisRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    dataset_id: str
    dataset_name: Optional[str] = None
    dataset_version: int
    processed_dataset_id: Optional[str] = None
    processed_dataset_name: Optional[str] = None
    run_type: str
    status: str
    configuration: Optional[Dict[str, Any]] = None
    input_artifacts: Optional[Dict[str, Any]] = None
    output_artifacts: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    created_at: datetime


class AnalysisRunListResponse(BaseModel):
    runs: List[AnalysisRunResponse]
    total: int
    project_id: Optional[str] = None
    dataset_id: Optional[str] = None
