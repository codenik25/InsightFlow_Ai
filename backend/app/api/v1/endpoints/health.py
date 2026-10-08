from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.health import HealthCheckResponse, ReadinessResponse
from app.services.health_service import HealthService

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse)
def get_v1_health(db: Session = Depends(get_db)) -> HealthCheckResponse:
    """Version 1 health check endpoint /api/v1/health."""
    return HealthService.check_health(db=db)


@router.get("/health/live", response_model=HealthCheckResponse)
def get_v1_liveness() -> HealthCheckResponse:
    """Liveness probe verifying that the API process is alive."""
    return HealthService.check_liveness()


@router.get("/health/ready", response_model=ReadinessResponse)
def get_v1_readiness(response: Response, db: Session = Depends(get_db)) -> ReadinessResponse:
    """Readiness probe verifying that critical backend dependencies (PostgreSQL) are operational."""
    is_ready, result = HealthService.check_readiness(db=db)
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result

