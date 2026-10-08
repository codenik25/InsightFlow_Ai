from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectWithDatasetsResponse,
)
from app.schemas.comparison import DatasetVersionListResponse
from app.schemas.analysis_run import AnalysisRunListResponse
from app.schemas.insight_memory import InsightMemoryListResponse
from app.services.project_service import ProjectService
from app.services.dataset_comparison_service import DatasetComparisonService
from app.services.analysis_run_service import AnalysisRunService

router = APIRouter()


@router.get("", response_model=List[ProjectResponse])
def list_projects(
    workspace_id: Optional[str] = Query(None, description="Optional workspace filter"),
    db: Session = Depends(get_db),
) -> List[ProjectResponse]:
    """List projects, defaulting to active workspace projects if no workspace_id provided."""
    return ProjectService.list_projects(db, workspace_id=workspace_id)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Create a project in the active or specified workspace."""
    return ProjectService.create_project(db, payload)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Fetch project details and metadata."""
    return ProjectService.get_project(db, project_id)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Update project name and description."""
    return ProjectService.update_project(db, project_id, payload)


@router.get("/{project_id}/datasets", response_model=ProjectWithDatasetsResponse)
def get_project_datasets(
    project_id: str,
    db: Session = Depends(get_db),
) -> ProjectWithDatasetsResponse:
    """Retrieve full dataset registry for a project including row count, column count, quality score, status, and lineage."""
    return ProjectService.get_project_with_datasets(db, project_id)


@router.get("/{project_id}/versions", response_model=DatasetVersionListResponse)
def get_project_versions(
    project_id: str,
    lineage: Optional[str] = Query(None, description="Optional dataset lineage filter"),
    db: Session = Depends(get_db),
) -> DatasetVersionListResponse:
    """Retrieve dataset versions for a project grouped by lineage or filtered by lineage."""
    return DatasetComparisonService.get_project_versions(db, project_id, lineage=lineage)


@router.get("/{project_id}/runs", response_model=AnalysisRunListResponse)
def get_project_runs(
    project_id: str,
    run_type: Optional[str] = Query(None, description="Filter by run type (EDA, INSIGHTS, PREDICTION, etc.)"),
    status: Optional[str] = Query(None, description="Filter by status (RUNNING, COMPLETED, FAILED)"),
    dataset_version: Optional[int] = Query(None, description="Filter by dataset version"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> AnalysisRunListResponse:
    """Retrieve analysis runs for a project with optional filters."""
    # Ensure project exists
    project = ProjectService.get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found.",
        )
    runs, total = AnalysisRunService.list_project_runs(
        db,
        project_id=project_id,
        run_type=run_type,
        status=status,
        dataset_version=dataset_version,
        limit=limit,
        offset=offset,
    )
    return AnalysisRunListResponse(
        runs=runs,
        total=total,
        project_id=project_id,
    )


@router.get("/{project_id}/insight-memory", response_model=InsightMemoryListResponse)
def get_project_insight_memory(
    project_id: str,
    status: Optional[str] = Query(None, description="Filter by status (NEW, PERSISTED, STRENGTHENED, WEAKENED, DISAPPEARED)"),
    category: Optional[str] = Query(None, description="Filter by category (CORRELATION, PERFORMANCE, etc.)"),
    lineage: Optional[str] = Query(None, description="Filter by dataset lineage name"),
    dataset_version: Optional[int] = Query(None, description="Filter by observed dataset version"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> InsightMemoryListResponse:
    """
    Retrieve persistent Insight Memory records and multi-version timeline for a project.
    """
    from app.services.insight_memory_service import InsightMemoryService
    return InsightMemoryService.list_project_memory(
        db,
        project_id=project_id,
        status_filter=status,
        category=category,
        lineage=lineage,
        dataset_version=dataset_version,
        limit=limit,
        offset=offset,
    )



