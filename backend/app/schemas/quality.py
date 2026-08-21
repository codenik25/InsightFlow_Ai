from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class IssueDetail(BaseModel):
    category: str  # 'completeness', 'uniqueness', 'validity', 'consistency', 'structural'
    severity: str  # 'info', 'warning', 'critical'
    description: str
    column: Optional[str] = None
    count: int = 0


class CompletenessMetrics(BaseModel):
    total_missing_cells: int
    missing_percentage: float
    missing_by_column: Dict[str, int] = Field(default_factory=dict)


class UniquenessMetrics(BaseModel):
    duplicate_rows: int
    duplicate_row_percentage: float
    identifier_duplicates: Dict[str, int] = Field(default_factory=dict)


class ValidityMetrics(BaseModel):
    total_invalid_cells: int
    invalid_percentage: float
    invalid_by_column: Dict[str, int] = Field(default_factory=dict)


class ConsistencyMetrics(BaseModel):
    whitespace_issues_count: int
    casing_inconsistencies_count: int
    inconsistent_columns: List[str] = Field(default_factory=list)


class StructuralMetrics(BaseModel):
    empty_columns: List[str] = Field(default_factory=list)
    constant_columns: List[str] = Field(default_factory=list)
    duplicate_column_names: List[str] = Field(default_factory=list)


class QualityScore(BaseModel):
    overall_score: int
    completeness_score: int
    uniqueness_score: int
    validity_score: int
    consistency_score: int
    structural_score: int
    total_issue_count: int
    severity: str  # 'Critical', 'Poor', 'Fair', 'Good', 'Excellent'


class DatasetQualityResponse(BaseModel):
    dataset_id: str
    score: QualityScore
    completeness: CompletenessMetrics
    uniqueness: UniquenessMetrics
    validity: ValidityMetrics
    consistency: ConsistencyMetrics
    structural: StructuralMetrics
    issues: List[IssueDetail] = Field(default_factory=list)
