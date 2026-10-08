from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.logging import logger
from app.schemas.health import HealthCheckResponse, ReadinessResponse


class HealthService:
    @staticmethod
    def check_liveness() -> HealthCheckResponse:
        """Lightweight process liveness probe."""
        return HealthCheckResponse(
            status="healthy",
            project_name=settings.PROJECT_NAME,
            version=settings.VERSION,
            environment=settings.ENVIRONMENT,
            timestamp=datetime.now(timezone.utc),
            database_connected=True,
            details="Process is responsive",
        )

    @staticmethod
    def check_health(db: Session | None = None) -> HealthCheckResponse:
        """Standard health check probing database if session is provided."""
        db_connected = False
        db_message = "Database verification pending"

        if db is not None:
            try:
                db.execute(text("SELECT 1"))
                db_connected = True
                db_message = "PostgreSQL database connection operational"
            except Exception as exc:
                logger.warning(f"Health check DB probe failed: {type(exc).__name__}")
                db_connected = False
                db_message = "PostgreSQL database probe failed. Database connection unavailable."
        else:
            db_message = "No database session provided"

        return HealthCheckResponse(
            status="healthy" if db_connected else "degraded",
            project_name=settings.PROJECT_NAME,
            version=settings.VERSION,
            environment=settings.ENVIRONMENT,
            timestamp=datetime.now(timezone.utc),
            database_connected=db_connected,
            details=db_message,
        )

    @staticmethod
    def check_readiness(db: Session | None = None) -> tuple[bool, ReadinessResponse]:
        """Readiness check verifying critical dependency availability without leaking secrets."""
        db_connected = False
        db_message = "PostgreSQL database probe failed"

        if db is not None:
            try:
                db.execute(text("SELECT 1"))
                db_connected = True
                db_message = "PostgreSQL database operational"
            except Exception as exc:
                logger.warning(f"Readiness probe failed: {type(exc).__name__}")
                db_connected = False
                db_message = "Database service unreachable or not ready to accept queries."
        else:
            db_message = "No database session available to readiness probe."

        is_ready = db_connected
        return is_ready, ReadinessResponse(
            status="ready" if is_ready else "not_ready",
            project_name=settings.PROJECT_NAME,
            version=settings.VERSION,
            environment=settings.ENVIRONMENT,
            database_connected=db_connected,
            timestamp=datetime.now(timezone.utc),
            details=db_message,
        )

