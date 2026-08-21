from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Any


class DatasetBase(BaseModel):
    name: str = Field(..., max_length=255, json_schema_extra={"example": "Q3 Sales Report"})
    description: str | None = Field(None, json_schema_extra={"example": "Quarterly regional sales performance dataset"})
    file_path: str | None = Field(None, json_schema_extra={"example": "data/raw/sales_q3.csv"})
    file_size_bytes: int | None = Field(None, ge=0)
    row_count: int | None = Field(None, ge=0)
    column_count: int | None = Field(None, ge=0)
    mime_type: str | None = Field(None, json_schema_extra={"example": "text/csv"})
    status: str = Field(default="uploaded", json_schema_extra={"example": "profiled"})


class DatasetCreate(DatasetBase):
    pass


class DatasetResponse(DatasetBase):
    id: str = Field(...)
    created_at: datetime
    updated_at: datetime
    profile_data: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)


class DatasetListResponse(BaseModel):
    total: int
    items: list[DatasetResponse]
