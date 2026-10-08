from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
)
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
)
from app.services.workspace_service import WorkspaceService
from app.services.project_service import ProjectService

router = APIRouter()


@router.get("", response_model=List[WorkspaceResponse])
def list_workspaces(db: Session = Depends(get_db)) -> List[WorkspaceResponse]:
    """List all workspaces, creating a default workspace if none exist."""
    return WorkspaceService.list_workspaces(db)


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    db: Session = Depends(get_db),
) -> WorkspaceResponse:
    """Create a new workspace."""
    return WorkspaceService.create_workspace(db, payload)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
) -> WorkspaceResponse:
    """Fetch single workspace by ID."""
    return WorkspaceService.get_workspace(db, workspace_id)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdate,
    db: Session = Depends(get_db),
) -> WorkspaceResponse:
    """Update workspace details."""
    return WorkspaceService.update_workspace(db, workspace_id, payload)


@router.get("/{workspace_id}/projects", response_model=List[ProjectResponse])
def list_workspace_projects(
    workspace_id: str,
    db: Session = Depends(get_db),
) -> List[ProjectResponse]:
    """List all projects under a workspace with active dataset counts."""
    return ProjectService.list_projects(db, workspace_id=workspace_id)


@router.post("/{workspace_id}/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_workspace_project(
    workspace_id: str,
    payload: ProjectCreate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Create a new project under the given workspace."""
    payload.workspace_id = workspace_id
    return ProjectService.create_project(db, payload)
