from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.health import HealthCheckResponse
from app.services.health_service import HealthService

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse)
def get_v1_health(db: Session = Depends(get_db)) -> HealthCheckResponse:
    """Version 1 health check endpoint /api/v1/health."""
    return HealthService.check_health(db=db)
