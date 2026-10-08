from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.analysis_run import AnalysisRun
from app.models.dataset import Dataset
from app.models.project import Project
from app.schemas.analysis_run import AnalysisRunResponse


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AnalysisRunService:
    @staticmethod
    def resolve_run_dataset_context(
        db: Session, dataset_id: str
    ) -> Tuple[Optional[str], str, int, Optional[str]]:
        """
        Resolves the exact project ID, raw dataset ID, lineage version, and processed child dataset ID.
        If given a processed dataset, resolves to the raw parent dataset and parent version.
        If given a raw dataset, resolves to itself and looks up any associated processed child.
        """
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset '{dataset_id}' not found.")

        if dataset.is_processed and dataset.parent_id:
            parent = db.query(Dataset).filter(Dataset.id == dataset.parent_id).first()
            if parent:
                project_id = parent.project_id or dataset.project_id
                raw_dataset_id = parent.id
                dataset_version = parent.version
                processed_dataset_id = dataset.id
            else:
                project_id = dataset.project_id
                raw_dataset_id = dataset.id
                dataset_version = dataset.version
                processed_dataset_id = dataset.id
        else:
            project_id = dataset.project_id
            raw_dataset_id = dataset.id
            dataset_version = dataset.version
            proc_child = (
                db.query(Dataset)
                .filter(Dataset.parent_id == dataset.id, Dataset.is_processed == True)
                .order_by(Dataset.created_at.desc())
                .first()
            )
            processed_dataset_id = proc_child.id if proc_child else None

        return project_id, raw_dataset_id, dataset_version, processed_dataset_id

    @classmethod
    def start_run(
        cls,
        db: Session,
        dataset_id: str,
        run_type: str,
        configuration: Optional[Dict[str, Any]] = None,
        input_artifacts: Optional[Dict[str, Any]] = None,
    ) -> AnalysisRun:
        """
        Records the start of an analytical execution in RUNNING state.
        """
        project_id, raw_dataset_id, dataset_version, processed_dataset_id = (
            cls.resolve_run_dataset_context(db, dataset_id)
        )

        run = AnalysisRun(
            project_id=project_id,
            dataset_id=raw_dataset_id,
            dataset_version=dataset_version,
            processed_dataset_id=processed_dataset_id,
            run_type=run_type,
            status="RUNNING",
            configuration=configuration or {},
            input_artifacts=input_artifacts or {},
            started_at=utc_now(),
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    @classmethod
    def complete_run(
        cls,
        db: Session,
        run_id: str,
        output_artifacts: Optional[Dict[str, Any]] = None,
    ) -> Optional[AnalysisRun]:
        """
        Marks an analytical execution as COMPLETED, calculates duration_ms, and records output artifacts.
        """
        run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
        if not run:
            return None

        now = utc_now()
        run.status = "COMPLETED"
        run.completed_at = now
        run.output_artifacts = output_artifacts or {}
        if run.started_at:
            # Handle tz-aware and tz-naive safely
            start = run.started_at
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            run.duration_ms = max(0, int((now - start).total_seconds() * 1000))

        db.commit()
        db.refresh(run)
        return run

    @classmethod
    def fail_run(
        cls,
        db: Session,
        run_id: str,
        error_message: str,
    ) -> Optional[AnalysisRun]:
        """
        Marks an analytical execution as FAILED and records the error message.
        Safely rolls back any aborted transaction state prior to updating the run status.
        """
        try:
            db.rollback()
        except Exception:
            pass

        run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
        if not run:
            return None

        now = utc_now()
        run.status = "FAILED"
        run.completed_at = now
        run.error_message = error_message
        if run.started_at:
            start = run.started_at
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            run.duration_ms = max(0, int((now - start).total_seconds() * 1000))

        db.commit()
        db.refresh(run)
        return run

    @classmethod
    def format_run_response(cls, run: AnalysisRun) -> AnalysisRunResponse:
        return AnalysisRunResponse(
            id=run.id,
            project_id=run.project_id,
            project_name=run.project.name if run.project else None,
            dataset_id=run.dataset_id,
            dataset_name=run.dataset.name if run.dataset else None,
            dataset_version=run.dataset_version,
            processed_dataset_id=run.processed_dataset_id,
            processed_dataset_name=(
                run.processed_dataset.name if run.processed_dataset else None
            ),
            run_type=run.run_type,
            status=run.status,
            configuration=run.configuration,
            input_artifacts=run.input_artifacts,
            output_artifacts=run.output_artifacts,
            error_message=run.error_message,
            started_at=run.started_at,
            completed_at=run.completed_at,
            duration_ms=run.duration_ms,
            created_at=run.created_at,
        )

    @classmethod
    def get_run(
        cls, db: Session, run_id: str, project_id: Optional[str] = None
    ) -> Optional[AnalysisRunResponse]:
        query = db.query(AnalysisRun).filter(AnalysisRun.id == run_id)
        if project_id:
            query = query.filter(AnalysisRun.project_id == project_id)
        run = query.first()
        if not run:
            return None
        return cls.format_run_response(run)

    @classmethod
    def list_project_runs(
        cls,
        db: Session,
        project_id: str,
        run_type: Optional[str] = None,
        status: Optional[str] = None,
        dataset_version: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[AnalysisRunResponse], int]:
        query = db.query(AnalysisRun).filter(AnalysisRun.project_id == project_id)
        if run_type:
            query = query.filter(AnalysisRun.run_type == run_type)
        if status:
            query = query.filter(AnalysisRun.status == status)
        if dataset_version is not None:
            query = query.filter(AnalysisRun.dataset_version == dataset_version)

        total = query.count()
        runs = (
            query.order_by(AnalysisRun.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [cls.format_run_response(r) for r in runs], total

    @classmethod
    def list_dataset_runs(
        cls,
        db: Session,
        dataset_id: str,
        run_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[AnalysisRunResponse], int]:
        query = db.query(AnalysisRun).filter(
            or_(
                AnalysisRun.dataset_id == dataset_id,
                AnalysisRun.processed_dataset_id == dataset_id,
            )
        )
        if run_type:
            query = query.filter(AnalysisRun.run_type == run_type)
        if status:
            query = query.filter(AnalysisRun.status == status)

        total = query.count()
        runs = (
            query.order_by(AnalysisRun.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [cls.format_run_response(r) for r in runs], total
