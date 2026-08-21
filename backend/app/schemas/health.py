from datetime import datetime
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field(..., json_schema_extra={"example": "healthy"})
    project_name: str = Field(..., json_schema_extra={"example": "InsightFlow AI"})
    version: str = Field(..., json_schema_extra={"example": "0.1.0"})
    environment: str = Field(..., json_schema_extra={"example": "development"})
    timestamp: datetime = Field(...)
    database_connected: bool = Field(...)
    details: str | None = Field(None, json_schema_extra={"example": "Database connection operational"})
