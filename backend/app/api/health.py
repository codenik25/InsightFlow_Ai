from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.health import HealthCheckResponse
from app.services.health_service import HealthService

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthCheckResponse)
def get_top_level_health(db: Session = Depends(get_db)) -> HealthCheckResponse:
    """Top-level health check endpoint /api/health."""
    return HealthService.check_health(db=db)
