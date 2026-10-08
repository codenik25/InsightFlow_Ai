from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class InsightMemoryBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    dataset_lineage: str
    insight_fingerprint: str
    category: str
    title: str
    affected_columns: Optional[List[str]] = Field(default_factory=list)
    latest_insight_id: Optional[str] = None
    first_seen_run_id: str
    latest_run_id: str
    first_seen_version: int
    latest_seen_version: int
    status: str  # NEW, PERSISTED, STRENGTHENED, WEAKENED, DISAPPEARED
    strength_baseline: Optional[float] = None
    strength_latest: Optional[float] = None
    delta_magnitude: Optional[float] = 0.0
    impact_summary: Optional[str] = None
    last_seen_at: str
    created_at: str
    updated_at: str


class InsightMemoryCounters(BaseModel):
    total: int = 0
    new_count: int = 0
    persisted_count: int = 0
    strengthened_count: int = 0
    weakened_count: int = 0
    disappeared_count: int = 0


class InsightTimelineCell(BaseModel):
    version: int
    observed: bool
    status: str  # NEW, PERSISTED, STRENGTHENED, WEAKENED, DISAPPEARED, NOT_OBSERVED
    strength: Optional[float] = None
    run_id: Optional[str] = None


class InsightTimelineItem(BaseModel):
    fingerprint: str
    title: str
    category: str
    current_status: str
    first_seen_version: int
    latest_seen_version: int
    cells: List[InsightTimelineCell] = Field(default_factory=list)


class DownstreamReviewItem(BaseModel):
    recommendation_id: str
    title: str
    target_metric: str
    linked_insight_id: Optional[str] = None
    linked_insight_title: Optional[str] = None
    linked_insight_status: str
    review_required: bool = True
    reason: str


class InsightImpactItem(BaseModel):
    fingerprint: str
    title: str
    category: str
    status: str  # NEW, PERSISTED, STRENGTHENED, WEAKENED, DISAPPEARED
    baseline_strength: Optional[float] = None
    comparison_strength: Optional[float] = None
    delta_magnitude: Optional[float] = None
    explanation: str


class InsightMemoryListResponse(BaseModel):
    project_id: str
    dataset_lineage: Optional[str] = None
    versions: List[int] = Field(default_factory=list)
    counters: InsightMemoryCounters
    items: List[InsightMemoryBase] = Field(default_factory=list)
    timeline: List[InsightTimelineItem] = Field(default_factory=list)


class InsightImpactComparisonResponse(BaseModel):
    project_id: str
    dataset_lineage: str
    base_dataset_id: str
    base_version: int
    comparison_dataset_id: str
    comparison_version: int
    counters: InsightMemoryCounters
    impacts: List[InsightImpactItem] = Field(default_factory=list)
    downstream_reviews: List[DownstreamReviewItem] = Field(default_factory=list)
