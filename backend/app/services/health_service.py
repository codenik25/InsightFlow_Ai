from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.logging import logger
from app.schemas.health import HealthCheckResponse


class HealthService:
    @staticmethod
    def check_health(db: Session | None = None) -> HealthCheckResponse:
        db_connected = False
        db_message = "Database verification pending"

        if db is not None:
            try:
                db.execute(text("SELECT 1"))
                db_connected = True
                db_message = "PostgreSQL database connection operational"
            except Exception as exc:
                logger.warning(f"Health check DB probe failed: {str(exc)}")
                db_connected = False
                db_message = f"PostgreSQL database unreachable: {str(exc)}"
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
