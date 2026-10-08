from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password with minimum 6 characters")
    full_name: str = Field(..., min_length=1, max_length=255, description="User full display name")
    role: Optional[str] = Field("Admin", description="User role in workspace")


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"


class ExistingDatasetSummary(BaseModel):
    id: str
    name: str
    file_size_bytes: Optional[int] = None
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    status: str
    quality_score: Optional[float] = None
    version: int = 1
    is_processed: bool = False
    created_at: datetime
    updated_at: datetime
    project_id: Optional[str] = None

    class Config:
        from_attributes = True


class ExistingDatasetListResponse(BaseModel):
    total: int
    items: List[ExistingDatasetSummary]
