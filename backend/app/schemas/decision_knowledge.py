"""Phase 14: Decision Knowledge & Operating Memory Pydantic Schemas."""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class KnowledgeCategory(str, Enum):
    OBSERVATION = "OBSERVATION"
    DECISION_LESSON = "DECISION_LESSON"
    OUTCOME_LESSON = "OUTCOME_LESSON"
    OPERATIONAL_NOTE = "OPERATIONAL_NOTE"
    ASSUMPTION = "ASSUMPTION"
    CONSTRAINT = "CONSTRAINT"


class KnowledgeEntryType(str, Enum):
    HUMAN_RECORDED = "HUMAN_RECORDED"
    SYSTEM_DERIVED = "SYSTEM_DERIVED"


ALLOWED_CATEGORIES = {c.value for c in KnowledgeCategory}


class KnowledgeEntryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500, description="Short descriptive title of the knowledge entry")
    content: str = Field(..., min_length=1, description="Detailed factual lesson, assumption, or operational note")
    category: str = Field(..., description="OBSERVATION, DECISION_LESSON, OUTCOME_LESSON, OPERATIONAL_NOTE, ASSUMPTION, CONSTRAINT")
    source_type: str = Field(default="USER", description="Source entity type (e.g. USER, DECISION, OUTCOME, LEARNING_SIGNAL, INSIGHT)")
    source_id: str = Field(default="USER", description="Specific ID of the referenced source entity")
    decision_id: Optional[str] = Field(None, description="Optional target decision ID")
    dataset_id: Optional[str] = Field(None, description="Optional target dataset ID")
    created_by: Optional[str] = Field(None, description="Human author identifier / attribution")

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        cat_upper = v.upper().strip()
        if cat_upper not in ALLOWED_CATEGORIES:
            raise ValueError(f"Category '{v}' invalid. Must be one of: {sorted(list(ALLOWED_CATEGORIES))}")
        return cat_upper


class KnowledgeEntryUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = None
    is_archived: Optional[bool] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cat_upper = v.upper().strip()
            if cat_upper not in ALLOWED_CATEGORIES:
                raise ValueError(f"Category '{v}' invalid. Must be one of: {sorted(list(ALLOWED_CATEGORIES))}")
            return cat_upper
        return v


class KnowledgeEntryResponse(BaseModel):
    id: str
    project_id: str
    decision_id: Optional[str] = None
    dataset_id: Optional[str] = None
    title: str
    content: str
    category: str
    source_type: str
    source_id: str
    entry_type: str
    created_by: Optional[str] = None
    is_archived: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectKnowledgeListResponse(BaseModel):
    project_id: str
    total_entries: int
    human_recorded_count: int
    system_derived_count: int
    total_human_recorded: int = 0
    total_system_derived: int = 0
    categories_breakdown: Dict[str, int]
    entries: List[KnowledgeEntryResponse]
