from typing import Any, List, Optional
from pydantic import BaseModel, Field


class ColumnRoleInfo(BaseModel):
    column: str
    role: str  # 'identifier', 'measure', 'categorical_dimension', 'datetime_dimension', 'text', 'boolean'
    reason: str
    inferred_type: str


class KPIMetric(BaseModel):
    name: str
    value: Any
    metric_type: str  # 'sum', 'mean', 'median', 'min', 'max', 'std', 'count', 'unique'
    source_column: Optional[str] = None
    format: Optional[str] = "number"  # 'currency', 'percentage', 'number', 'integer'
    reason: Optional[str] = None


class DatasetOverviewKPIs(BaseModel):
    total_rows: int
    total_columns: int
    measure_count: int
    dimension_count: int
    datetime_count: int
    total_missing_cells: int
    duplicate_rows: int
