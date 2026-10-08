from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.analysis_run import AnalysisRunResponse
from app.services.analysis_run_service import AnalysisRunService

router = APIRouter()


@router.get("/{run_id}", response_model=AnalysisRunResponse)
def get_run(
    run_id: str,
    project_id: Optional[str] = Query(None, description="Optional project boundary check"),
    db: Session = Depends(get_db),
) -> AnalysisRunResponse:
    """
    Fetch an individual analysis run by ID.
    If project_id is provided, enforces project boundary.
    """
    run = AnalysisRunService.get_run(db, run_id=run_id, project_id=project_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis run '{run_id}' not found.",
        )
    return run


@router.get("/{run_id}/insights")
def get_run_insights(
    run_id: str,
    project_id: Optional[str] = Query(None, description="Optional project boundary check"),
    db: Session = Depends(get_db),
):
    """
    Retrieve snapshot insights generated during a specific Analysis Run.
    Enforces project boundary if project_id is provided.
    """
    if project_id:
        run = AnalysisRunService.get_run(db, run_id=run_id, project_id=project_id)
        if not run:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Analysis run '{run_id}' not found in project '{project_id}'.",
            )
    from app.services.insight_memory_service import InsightMemoryService
    return InsightMemoryService.get_run_insights(db, run_id=run_id)


