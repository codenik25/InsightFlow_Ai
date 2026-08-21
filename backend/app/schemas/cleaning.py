from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from app.schemas.quality import QualityScore, CompletenessMetrics, UniquenessMetrics


class CleaningOperation(BaseModel):
    type: str  # 'remove_duplicates', 'fill_missing', 'remove_empty_columns', 'remove_constant_columns', 'trim_whitespace', 'convert_case', 'convert_type'
    column: Optional[str] = None
    strategy: Optional[str] = None  # 'drop_rows', 'mean', 'median', 'mode', 'constant', 'lowercase', 'uppercase'
    fill_value: Optional[Any] = None
    target_type: Optional[str] = None  # 'numeric', 'datetime'


class CleaningPlan(BaseModel):
    dataset_id: str
    operations: List[CleaningOperation] = Field(default_factory=list)


class ProposedChangeDetail(BaseModel):
    operation_type: str
    column: Optional[str] = None
    strategy: Optional[str] = None
    affected_rows: int
    description: str


class PreviewMetrics(BaseModel):
    total_rows: int
    total_columns: int
    total_missing_cells: int
    duplicate_rows: int
    quality_score: int
    severity: str


class CleaningPreviewResponse(BaseModel):
    dataset_id: str
    proposed_changes: List[ProposedChangeDetail]
    before: PreviewMetrics
    expected_after: PreviewMetrics


class CleaningApplyResponse(BaseModel):
    original_dataset_id: str
    output_dataset_id: str
    processed_filename: str
    storage_key: str
    transformation_logs_count: int
    before: PreviewMetrics
    after: PreviewMetrics
    transformation_logs: List[Dict[str, Any]] = Field(default_factory=list)
