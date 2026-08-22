from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ExecutiveKPINode(BaseModel):
    name: str = Field(..., description="Display name of the metric KPI")
    value: float = Field(..., description="Calculated metric value")
    formatted_value: str = Field(..., description="Formatted string representation of the value")
    aggregation: str = Field(..., description="Aggregation method: sum, mean, etc.")
    nature: str = Field(..., description="Metric nature: amount_value, quantity_count, price_rate")
    unit: Optional[str] = None
    reason: Optional[str] = None


class ExecutiveHighlight(BaseModel):
    id: str = Field(..., description="Unique ID of the highlight")
    highlight_type: str = Field(..., description="Highlight type: ACHIEVEMENT, RISK, OPPORTUNITY")
    title: str = Field(..., description="Headline title")
    summary: str = Field(..., description="Summary observation")
    source_insight_id: Optional[str] = None
    priority_score: float = Field(..., description="Priority score for ordering")
    evidence: Optional[Dict[str, Any]] = None


class StrategicAction(BaseModel):
    priority: int = Field(..., description="1-indexed action priority rank")
    title: str = Field(..., description="Action title")
    recommendation: str = Field(..., description="Evidence-backed recommendation")
    target_metric: Optional[str] = None
    target_dimension: Optional[str] = None
    source_insight_id: Optional[str] = None


class ExecutiveReport(BaseModel):
    dataset_id: str = Field(..., description="Processed dataset ID")
    raw_dataset_id: Optional[str] = Field(None, description="Raw dataset ID if resolved")
    dataset_name: str = Field(..., description="Dataset filename or display name")
    source_dataset_name: Optional[str] = Field(None, description="Original raw source dataset name")
    generated_at: str = Field(..., description="ISO UTC timestamp")
    quality_score: float = Field(..., description="Data quality score after cleaning (0-100)")
    total_rows: int = Field(..., description="Total row count in processed dataset")
    total_columns: int = Field(..., description="Total column count in processed dataset")
    key_kpis: List[ExecutiveKPINode] = Field(default_factory=list)
    executive_narrative: str = Field(..., description="Deterministic, concise executive summary paragraph")
    key_achievements: List[ExecutiveHighlight] = Field(default_factory=list)
    critical_risks: List[ExecutiveHighlight] = Field(default_factory=list)
    key_opportunities: List[ExecutiveHighlight] = Field(default_factory=list)
    strategic_actions: List[StrategicAction] = Field(default_factory=list)
    total_insights_analyzed: int = Field(..., description="Total underlying insights analyzed")
