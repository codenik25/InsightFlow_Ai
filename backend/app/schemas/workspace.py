from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class WorkspaceBase(BaseModel):
    name: str = Field(..., max_length=255, json_schema_extra={"example": "Nikunj's Workspace"})
    description: str | None = Field(None, json_schema_extra={"example": "Primary Decision Intelligence Workspace"})


class WorkspaceCreate(WorkspaceBase):
    pass


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None


class WorkspaceResponse(WorkspaceBase):
    id: str = Field(...)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
