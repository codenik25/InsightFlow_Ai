from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TransformationLogResponse(BaseModel):
    id: str
    dataset_id: str
    output_dataset_id: Optional[str] = None
    operation_type: str
    column_name: Optional[str] = None
    strategy: Optional[str] = None
    affected_rows: int
    details: Optional[Dict[str, Any]] = None
    created_at: datetime


class TransformationHistoryResponse(BaseModel):
    dataset_id: str
    total: int
    items: List[TransformationLogResponse] = Field(default_factory=list)
