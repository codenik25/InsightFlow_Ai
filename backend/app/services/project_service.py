import uuid
from typing import List, Optional
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.logging import logger
from app.models.project import Project
from app.models.dataset import Dataset
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectWithDatasetsResponse
from app.schemas.dataset import DatasetRegistryItem
from app.services.workspace_service import WorkspaceService


class ProjectService:
    @staticmethod
    def _compute_dataset_quality_score(profile_data: Optional[dict]) -> Optional[float]:
        """Derive deterministic quality score from stored profile_data."""
        if not profile_data:
            return None
        # Check if already stored directly
        if "quality_score" in profile_data and profile_data["quality_score"] is not None:
            return float(profile_data["quality_score"])
        if "score" in profile_data and isinstance(profile_data["score"], dict):
            if "overall_score" in profile_data["score"] and profile_data["score"]["overall_score"] is not None:
                return float(profile_data["score"]["overall_score"])

        # Calculate from quality summary & column null percentages
        quality_info = profile_data.get("quality", {})
        dup_pct = float(quality_info.get("duplicate_row_percentage", 0.0) or 0.0)

        cols = profile_data.get("columns", [])
        if cols and isinstance(cols, list):
            null_pcts = [float(c.get("null_percentage", 0.0) or 0.0) for c in cols if isinstance(c, dict)]
            avg_null = sum(null_pcts) / len(null_pcts) if null_pcts else 0.0
        else:
            avg_null = 0.0

        score = max(0.0, min(100.0, 100.0 - (dup_pct * 0.5) - (avg_null * 0.5)))
        return round(score, 1)

    @staticmethod
    def list_projects(db: Session, workspace_id: Optional[str] = None) -> List[ProjectResponse]:
        """Fetch all projects for a workspace with dataset counts."""
        if not workspace_id:
            ws = WorkspaceService.get_or_create_default_workspace(db)
            workspace_id = ws.id
        else:
            WorkspaceService.get_workspace(db, workspace_id)

        stmt = select(Project).where(Project.workspace_id == workspace_id).order_by(Project.created_at.asc())
        projects = list(db.scalars(stmt).all())

        if not projects:
            default_proj = Project(
                id=str(uuid.uuid4()),
                workspace_id=workspace_id,
                name="Hospital Operations",
                description="Hospital operations, readmission intelligence, and resource optimization",
            )
            db.add(default_proj)
            db.commit()
            db.refresh(default_proj)
            projects = [default_proj]

        results = []
        for p in projects:
            ds_count = db.scalar(
                select(func.count(Dataset.id)).where(Dataset.project_id == p.id)
            ) or 0
            results.append(
                ProjectResponse(
                    id=p.id,
                    workspace_id=p.workspace_id,
                    name=p.name,
                    description=p.description,
                    dataset_count=ds_count,
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                )
            )
        return results

    @staticmethod
    def get_project(db: Session, project_id: str) -> ProjectResponse:
        """Fetch single project by ID."""
        stmt = select(Project).where(Project.id == project_id)
        p = db.scalar(stmt)
        if not p:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )
        ds_count = db.scalar(
            select(func.count(Dataset.id)).where(Dataset.project_id == p.id)
        ) or 0
        return ProjectResponse(
            id=p.id,
            workspace_id=p.workspace_id,
            name=p.name,
            description=p.description,
            dataset_count=ds_count,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )

    @staticmethod
    def create_project(db: Session, data: ProjectCreate) -> ProjectResponse:
        """Create new project under workspace."""
        if not data.workspace_id:
            ws = WorkspaceService.get_or_create_default_workspace(db)
            ws_id = ws.id
        else:
            ws = WorkspaceService.get_workspace(db, data.workspace_id)
            ws_id = ws.id

        proj = Project(
            id=str(uuid.uuid4()),
            workspace_id=ws_id,
            name=data.name.strip(),
            description=data.description.strip() if data.description else None,
        )
        db.add(proj)
        db.commit()
        db.refresh(proj)
        logger.info(f"Created project '{proj.name}' ({proj.id}) in workspace '{ws_id}'.")
        return ProjectResponse(
            id=proj.id,
            workspace_id=proj.workspace_id,
            name=proj.name,
            description=proj.description,
            dataset_count=0,
            created_at=proj.created_at,
            updated_at=proj.updated_at,
        )

    @staticmethod
    def update_project(db: Session, project_id: str, data: ProjectUpdate) -> ProjectResponse:
        """Update project details."""
        stmt = select(Project).where(Project.id == project_id)
        p = db.scalar(stmt)
        if not p:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )
        if data.name is not None and data.name.strip():
            p.name = data.name.strip()
        if data.description is not None:
            p.description = data.description.strip()
        db.commit()
        db.refresh(p)
        ds_count = db.scalar(
            select(func.count(Dataset.id)).where(Dataset.project_id == p.id)
        ) or 0
        return ProjectResponse(
            id=p.id,
            workspace_id=p.workspace_id,
            name=p.name,
            description=p.description,
            dataset_count=ds_count,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )

    @classmethod
    def get_project_with_datasets(cls, db: Session, project_id: str) -> ProjectWithDatasetsResponse:
        """Fetch project details and full dataset registry items."""
        stmt = select(Project).where(Project.id == project_id)
        p = db.scalar(stmt)
        if not p:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        ds_stmt = select(Dataset).where(Dataset.project_id == p.id).order_by(Dataset.created_at.desc())
        datasets = list(db.scalars(ds_stmt).all())

        registry_items = []
        for ds in datasets:
            q_score = cls._compute_dataset_quality_score(ds.profile_data)
            reg_status = "READY"
            if ds.status in ["uploaded", "processing"]:
                reg_status = "PROCESSING"
            elif ds.status == "failed":
                reg_status = "FAILED"
            elif ds.status in ["profiled", "ready", "cleaned"]:
                reg_status = "READY"

            registry_items.append(
                DatasetRegistryItem(
                    id=ds.id,
                    name=ds.name,
                    description=ds.description,
                    project_id=ds.project_id or p.id,
                    version=getattr(ds, "version", 1) or 1,
                    file_path=ds.file_path,
                    file_size_bytes=ds.file_size_bytes,
                    row_count=ds.row_count,
                    column_count=ds.column_count,
                    mime_type=ds.mime_type,
                    status=reg_status,
                    is_processed=ds.is_processed,
                    parent_id=ds.parent_id,
                    quality_score=q_score,
                    created_at=ds.created_at,
                    updated_at=ds.updated_at,
                )
            )

        return ProjectWithDatasetsResponse(
            id=p.id,
            workspace_id=p.workspace_id,
            name=p.name,
            description=p.description,
            dataset_count=len(registry_items),
            created_at=p.created_at,
            updated_at=p.updated_at,
            datasets=registry_items,
        )
