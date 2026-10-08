from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, Field


class ComparisonSummary(BaseModel):
    base_dataset_id: str
    base_version: int
    base_name: str
    comparison_dataset_id: str
    comparison_version: int
    comparison_name: str
    
    rows_base: int
    rows_comparison: int
    rows_change: int
    rows_change_pct: float
    
    columns_base: int
    columns_comparison: int
    columns_added_count: int
    columns_removed_count: int
    
    quality_base: Optional[float] = None
    quality_comparison: Optional[float] = None
    quality_change: Optional[float] = None
    
    missing_cells_base: int = 0
    missing_cells_comparison: int = 0
    missing_cells_change: int = 0

    duplicate_rows_base: int = 0
    duplicate_rows_comparison: int = 0
    duplicate_rows_change: int = 0


class SchemaChange(BaseModel):
    column: str
    change_type: str  # "added" | "removed" | "type_changed" | "unchanged"
    base_type: Optional[str] = None
    comparison_type: Optional[str] = None


class QualityChangeDetail(BaseModel):
    previous_score: Optional[float] = None
    current_score: Optional[float] = None
    delta: Optional[float] = None
    status: str  # "improved" | "degraded" | "stable"
    missing_percentage_delta: float = 0.0
    duplicate_percentage_delta: float = 0.0


class MetricChange(BaseModel):
    column: str
    base_mean: Optional[float] = None
    comparison_mean: Optional[float] = None
    mean_change_pct: Optional[float] = None
    base_median: Optional[float] = None
    comparison_median: Optional[float] = None
    median_change_pct: Optional[float] = None
    base_std: Optional[float] = None
    comparison_std: Optional[float] = None
    base_min: Optional[float] = None
    comparison_min: Optional[float] = None
    base_max: Optional[float] = None
    comparison_max: Optional[float] = None
    is_significant: bool = False
    significance_reason: Optional[str] = None


class DistributionChange(BaseModel):
    column: str
    column_type: str  # "numeric" | "categorical"
    new_categories: List[str] = Field(default_factory=list)
    disappeared_categories: List[str] = Field(default_factory=list)
    shift_description: str
    is_significant: bool = False


class InsightImpact(BaseModel):
    insight_id: str
    title: str
    category: str
    severity: str
    status: str  # "SUPPORTED" | "CHANGED" | "NO LONGER OBSERVED" | "INSUFFICIENT DATA"
    explanation: str


class PredictionImpact(BaseModel):
    total_models: int = 0
    schema_status: str  # "MODEL INPUT SCHEMA CHANGED" | "SCHEMA UNCHANGED" | "NO MODELS TRAINED"
    refresh_recommended: bool = False
    affected_features: List[str] = Field(default_factory=list)
    missing_targets: List[str] = Field(default_factory=list)
    details: str


class DatasetComparisonResponse(BaseModel):
    base_dataset_id: str
    comparison_dataset_id: str
    summary: ComparisonSummary
    schema_changes: List[SchemaChange]
    quality_changes: QualityChangeDetail
    metric_changes: List[MetricChange]
    distribution_changes: List[DistributionChange]
    significant_changes: List[str]
    insight_impacts: List[InsightImpact]
    prediction_impact: PredictionImpact

    model_config = ConfigDict(from_attributes=True)


class DatasetVersionItem(BaseModel):
    id: str
    project_id: Optional[str] = None
    version: int
    name: str
    description: Optional[str] = None
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    file_size_bytes: Optional[int] = None
    quality_score: Optional[float] = None
    status: str
    is_processed: bool
    parent_id: Optional[str] = None
    lineage_name: Optional[str] = None
    has_processed_child: bool = False
    processed_child_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetFamilyGroup(BaseModel):
    lineage_name: str
    total_versions: int
    versions: List[DatasetVersionItem]

    model_config = ConfigDict(from_attributes=True)


class DatasetVersionListResponse(BaseModel):
    project_id: Optional[str] = None
    lineage_name: Optional[str] = None
    total_versions: int
    versions: List[DatasetVersionItem]
    lineages: List[str] = []
    families: Optional[List[DatasetFamilyGroup]] = None

    model_config = ConfigDict(from_attributes=True)
