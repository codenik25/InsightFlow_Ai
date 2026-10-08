from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Any


class DatasetBase(BaseModel):
    name: str = Field(..., max_length=255, json_schema_extra={"example": "Q3 Sales Report"})
    description: str | None = Field(None, json_schema_extra={"example": "Quarterly regional sales performance dataset"})
    project_id: str | None = Field(None, json_schema_extra={"example": "uuid-project-id"})
    file_path: str | None = Field(None, json_schema_extra={"example": "data/raw/sales_q3.csv"})
    file_size_bytes: int | None = Field(None, ge=0)
    row_count: int | None = Field(None, ge=0)
    column_count: int | None = Field(None, ge=0)
    mime_type: str | None = Field(None, json_schema_extra={"example": "text/csv"})
    status: str = Field(default="uploaded", json_schema_extra={"example": "profiled"})
    version: int = Field(default=1, ge=1, json_schema_extra={"example": 1})


class DatasetCreate(DatasetBase):
    pass


class DatasetResponse(DatasetBase):
    id: str = Field(...)
    is_processed: bool = False
    parent_id: str | None = None
    created_at: datetime
    updated_at: datetime
    profile_data: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)


class DatasetRegistryItem(BaseModel):
    id: str
    name: str
    description: str | None = None
    project_id: str | None = None
    version: int = 1
    file_path: str | None = None
    file_size_bytes: int | None = None
    row_count: int | None = None
    column_count: int | None = None
    mime_type: str | None = None
    status: str
    is_processed: bool = False
    parent_id: str | None = None
    quality_score: float | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetListResponse(BaseModel):
    total: int
    items: list[DatasetResponse]
