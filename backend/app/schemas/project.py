from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.dataset import DatasetRegistryItem


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, json_schema_extra={"example": "Hospital Operations"})
    description: str | None = Field(None, json_schema_extra={"example": "Hospital operations and readmission intelligence"})


class ProjectCreate(ProjectBase):
    workspace_id: str | None = Field(None, description="Optional workspace ID, defaults to active default workspace if omitted")


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None


class ProjectResponse(ProjectBase):
    id: str = Field(...)
    workspace_id: str = Field(...)
    dataset_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectWithDatasetsResponse(ProjectResponse):
    datasets: list[DatasetRegistryItem] = []
