from typing import Any, List, Optional
from pydantic import BaseModel, Field


class NumericStats(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    median: Optional[float] = None
    std: Optional[float] = None
    p25: Optional[float] = None
    p50: Optional[float] = None
    p75: Optional[float] = None


class CategoricalValueCount(BaseModel):
    value: str
    count: int
    percentage: float


class CategoricalStats(BaseModel):
    top_values: List[CategoricalValueCount] = Field(default_factory=list)
    unique_count: int = 0


class DatetimeStats(BaseModel):
    min_date: Optional[str] = None
    max_date: Optional[str] = None
    date_range_days: Optional[float] = None


class ColumnProfile(BaseModel):
    name: str
    inferred_type: str
    null_count: int
    null_percentage: float
    unique_count: int
    unique_percentage: float
    sample_values: List[Any] = Field(default_factory=list)
    numeric_stats: Optional[NumericStats] = None
    categorical_stats: Optional[CategoricalStats] = None
    datetime_stats: Optional[DatetimeStats] = None


class QualitySummary(BaseModel):
    duplicate_row_count: int = 0
    duplicate_row_percentage: float = 0.0
    empty_columns: List[str] = Field(default_factory=list)
    constant_columns: List[str] = Field(default_factory=list)


class DatasetOverview(BaseModel):
    filename: str
    total_rows: int
    total_columns: int
    file_size_bytes: int
    memory_usage_bytes: int
    duplicate_rows: int
    duplicate_row_percentage: float
    empty_column_count: int
    constant_column_count: int


class DatasetProfileResponse(BaseModel):
    dataset_id: str
    overview: DatasetOverview
    columns: List[ColumnProfile]
    quality: QualitySummary
