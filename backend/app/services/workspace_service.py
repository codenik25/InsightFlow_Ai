import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.logging import logger
from app.models.workspace import Workspace
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate


class WorkspaceService:
    @staticmethod
    def get_or_create_default_workspace(db: Session) -> Workspace:
        """Fetch primary workspace or create default if no workspaces exist."""
        stmt = select(Workspace).order_by(Workspace.created_at.asc())
        ws = db.scalar(stmt)
        if ws:
            return ws

        ws = Workspace(
            id=str(uuid.uuid4()),
            name="Nikunj's Workspace",
            description="Primary workspace for Decision Intelligence",
        )
        db.add(ws)
        db.commit()
        db.refresh(ws)
        logger.info(f"Created default workspace '{ws.name}' ({ws.id}).")
        return ws

    @staticmethod
    def list_workspaces(db: Session) -> list[Workspace]:
        """Fetch all workspaces, guaranteeing at least default workspace exists."""
        stmt = select(Workspace).order_by(Workspace.created_at.asc())
        items = list(db.scalars(stmt).all())
        if not items:
            default_ws = WorkspaceService.get_or_create_default_workspace(db)
            return [default_ws]
        return items

    @staticmethod
    def get_workspace(db: Session, workspace_id: str) -> Workspace:
        """Retrieve workspace by ID or raise 404."""
        stmt = select(Workspace).where(Workspace.id == workspace_id)
        ws = db.scalar(stmt)
        if not ws:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workspace '{workspace_id}' not found.",
            )
        return ws

    @staticmethod
    def create_workspace(db: Session, data: WorkspaceCreate) -> Workspace:
        """Create a new workspace."""
        ws = Workspace(
            id=str(uuid.uuid4()),
            name=data.name.strip(),
            description=data.description.strip() if data.description else None,
        )
        db.add(ws)
        db.commit()
        db.refresh(ws)
        logger.info(f"Created workspace '{ws.name}' ({ws.id}).")
        return ws

    @staticmethod
    def update_workspace(db: Session, workspace_id: str, data: WorkspaceUpdate) -> Workspace:
        """Update workspace details."""
        ws = WorkspaceService.get_workspace(db, workspace_id)
        if data.name is not None and data.name.strip():
            ws.name = data.name.strip()
        if data.description is not None:
            ws.description = data.description.strip()
        db.commit()
        db.refresh(ws)
        return ws
