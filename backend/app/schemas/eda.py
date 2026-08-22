from typing import Any, List, Optional
from pydantic import BaseModel, Field
from app.schemas.kpi import ColumnRoleInfo, KPIMetric, DatasetOverviewKPIs


class GroupedCategoryValue(BaseModel):
    category_value: str
    metric_value: float
    contribution_pct: float


class CategoryBreakdown(BaseModel):
    dimension: str
    measure: str
    total_measure_value: float
    aggregation_method: Optional[str] = "sum"  # 'sum' | 'mean'
    top_category: Optional[GroupedCategoryValue] = None
    bottom_category: Optional[GroupedCategoryValue] = None
    top_5: List[GroupedCategoryValue] = Field(default_factory=list)
    bottom_5: List[GroupedCategoryValue] = Field(default_factory=list)
    grouped_data: List[GroupedCategoryValue] = Field(default_factory=list)


class TimeSeriesPoint(BaseModel):
    period: str
    value: float
    count: int


class TrendMetric(BaseModel):
    measure: str
    datetime_column: str
    granularity: str  # 'daily', 'weekly', 'monthly'
    trend_direction: str  # 'increasing', 'decreasing', 'stable', 'insufficient_data'
    slope: float
    pct_change: float
    first_period_value: Optional[float] = None
    latest_period_value: Optional[float] = None
    time_series: List[TimeSeriesPoint] = Field(default_factory=list)


class RelationshipMetric(BaseModel):
    column_a: str
    column_b: str
    correlation: float
    strength: str  # 'strong_positive', 'moderate_positive', 'neutral', 'moderate_negative', 'strong_negative'


class DistributionStats(BaseModel):
    column: str
    min: float
    max: float
    mean: float
    median: float
    std: float
    p25: float
    p50: float
    p75: float
    iqr: float
    skewness: float
    zero_count: int
    is_constant: bool


class EDAResponse(BaseModel):
    id: str
    dataset_id: str
    created_at: str
    column_roles: List[ColumnRoleInfo] = Field(default_factory=list)
    overview_kpis: DatasetOverviewKPIs
    discovered_kpis: List[KPIMetric] = Field(default_factory=list)
    category_breakdowns: List[CategoryBreakdown] = Field(default_factory=list)
    trends: List[TrendMetric] = Field(default_factory=list)
    relationships: List[RelationshipMetric] = Field(default_factory=list)
    distributions: List[DistributionStats] = Field(default_factory=list)
