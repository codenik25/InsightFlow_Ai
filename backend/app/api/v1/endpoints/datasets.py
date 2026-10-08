from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from app.core.database import get_db
from app.core.logging import logger
from app.models.dataset import Dataset
from app.models.transformation_log import TransformationLog
from app.schemas.dataset import DatasetCreate, DatasetResponse, DatasetListResponse
from app.schemas.profile import DatasetProfileResponse
from app.schemas.quality import DatasetQualityResponse
from app.schemas.cleaning import CleaningPlan, CleaningPreviewResponse, CleaningApplyResponse
from app.schemas.transformation import TransformationHistoryResponse, TransformationLogResponse
from app.schemas.comparison import DatasetComparisonResponse, DatasetVersionListResponse
from app.schemas.analysis_run import AnalysisRunListResponse
from app.schemas.insight_memory import (
    InsightMemoryListResponse,
    InsightImpactComparisonResponse,
)
from app.services.dataset_service import DatasetService
from app.services.quality_service import QualityService
from app.services.cleaning_service import CleaningService
from app.services.storage_service import storage_service
from app.services.dataset_comparison_service import DatasetComparisonService
from app.services.analysis_run_service import AnalysisRunService
from app.core.auth import get_current_user, verify_user_project_access, verify_user_dataset_access
from app.models.user import User
from app.models.project import Project
from app.models.workspace import Workspace
from app.schemas.auth import ExistingDatasetListResponse, ExistingDatasetSummary

router = APIRouter()


def _verify_dataset_project(dataset: Dataset, project_id: Optional[str]) -> None:
    """Enforce strict project boundary: raise 404 if dataset does not belong to specified project."""
    if project_id and dataset.project_id and dataset.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset.id}' not found in project '{project_id}'.",
        )


@router.get("/existing", response_model=ExistingDatasetListResponse)
def list_existing_datasets(
    project_id: Optional[str] = Query(None, description="Optional project ID filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExistingDatasetListResponse:
    """
    Retrieve existing dataset registry for authenticated user.
    Enforces server-side authentication (401) and workspace/project authorization (403).
    """
    query = db.query(Dataset)
    if project_id:
        verify_user_project_access(current_user, project_id, db)
        query = query.filter(Dataset.project_id == project_id)
    else:
        # If user has workspaces, isolate to user's workspaces
        user_ws_ids = [w.id for w in current_user.workspaces]
        if user_ws_ids:
            proj_ids = [p.id for p in db.query(Project.id).filter(Project.workspace_id.in_(user_ws_ids)).all()]
            query = query.filter((Dataset.project_id.in_(proj_ids)) | (Dataset.project_id == None))  # noqa: E711
    
    datasets = query.order_by(Dataset.created_at.desc()).limit(50).all()
    
    items = []
    for d in datasets:
        items.append(
            ExistingDatasetSummary(
                id=d.id,
                name=d.name,
                file_size_bytes=d.file_size_bytes,
                row_count=d.row_count,
                column_count=d.column_count,
                status=d.status,
                quality_score=(d.profile_data or {}).get("quality_score") if d.profile_data else None,
                version=d.version,
                is_processed=d.is_processed,
                created_at=d.created_at,
                updated_at=d.updated_at,
                project_id=d.project_id,
            )
        )
    return ExistingDatasetListResponse(total=len(items), items=items)


@router.get("/existing/{dataset_id}", response_model=ExistingDatasetSummary)
def get_existing_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExistingDatasetSummary:
    """
    Retrieve individual existing dataset metadata with IDOR authorization protection.
    Raises 401 if unauthenticated, 403 if dataset belongs to another user's project.
    """
    dataset = verify_user_dataset_access(current_user, dataset_id, db)
    return ExistingDatasetSummary(
        id=dataset.id,
        name=dataset.name,
        file_size_bytes=dataset.file_size_bytes,
        row_count=dataset.row_count,
        column_count=dataset.column_count,
        status=dataset.status,
        quality_score=(dataset.profile_data or {}).get("quality_score") if dataset.profile_data else None,
        version=dataset.version,
        is_processed=dataset.is_processed,
        created_at=dataset.created_at,
        updated_at=dataset.updated_at,
        project_id=dataset.project_id,
    )


@router.get("", response_model=DatasetListResponse)
def list_datasets(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    project_id: Optional[str] = Query(None, description="Optional project ID filter"),
    db: Session = Depends(get_db),
) -> DatasetListResponse:
    """Retrieve list of registered dataset metadata items."""
    try:
        items = DatasetService.list_datasets(db=db, skip=skip, limit=limit, project_id=project_id)
        total = DatasetService.count_datasets(db=db, project_id=project_id)
        return DatasetListResponse(total=total, items=items)
    except OperationalError as exc:
        logger.warning(f"Database operational error in dataset listing: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable. Please verify PostgreSQL container is running.",
        )


@router.post("/upload", response_model=DatasetProfileResponse, status_code=status.HTTP_201_CREATED)
def upload_csv_dataset(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
) -> DatasetProfileResponse:
    """Upload a CSV dataset, parse schema, compute automated data profile, and store metadata."""
    try:
        return DatasetService.ingest_and_profile_csv(db=db, file=file, project_id=project_id)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.warning(f"Database operational error in dataset upload: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable. Please verify PostgreSQL container is running.",
        )
    except Exception as exc:
        logger.error(f"Unexpected dataset upload failure: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process and profile dataset. Please consult system logs.",
        )


@router.post("", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
def create_dataset_metadata(
    data: DatasetCreate,
    db: Session = Depends(get_db),
) -> DatasetResponse:
    """Register metadata entry for a dataset manually."""
    try:
        return DatasetService.create_dataset_metadata(db=db, data=data)
    except OperationalError as exc:
        logger.warning(f"Database operational error in dataset creation: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable. Please verify PostgreSQL container is running.",
        )


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(
    dataset_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> DatasetResponse:
    """Get metadata for a specific dataset by ID with optional project isolation validation."""
    try:
        dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset with ID '{dataset_id}' not found.",
            )
        _verify_dataset_project(dataset, project_id)
        return dataset
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.warning(f"Database operational error in dataset retrieval: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable. Please verify PostgreSQL container is running.",
        )


@router.get("/{dataset_id}/profile", response_model=DatasetProfileResponse)
def get_dataset_profile(
    dataset_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> DatasetProfileResponse:
    """Retrieve saved data profile for a dataset by ID with optional project isolation validation."""
    try:
        dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset with ID '{dataset_id}' not found.",
            )
        _verify_dataset_project(dataset, project_id)
        if not dataset.profile_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No profile data found for dataset '{dataset_id}'.",
            )
        return DatasetProfileResponse(**dataset.profile_data)
    except HTTPException:
        raise

    except HTTPException:
        raise
    except OperationalError as exc:
        logger.warning(f"Database operational error in profile retrieval: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable. Please verify PostgreSQL container is running.",
        )


@router.get("/{dataset_id}/quality", response_model=DatasetQualityResponse)
def get_dataset_quality(
    dataset_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> DatasetQualityResponse:
    """Evaluate and retrieve 5-part data quality metrics & 0-100 score for a dataset."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )
    _verify_dataset_project(dataset, project_id)
    df = DatasetService.load_dataset_dataframe(dataset)
    return QualityService.evaluate_quality(df=df, dataset_id=dataset_id)


@router.post("/{dataset_id}/quality", response_model=DatasetQualityResponse)
def compute_dataset_quality(
    dataset_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> DatasetQualityResponse:
    """Post alias for dataset quality evaluation."""
    return get_dataset_quality(dataset_id=dataset_id, project_id=project_id, db=db)


@router.post("/{dataset_id}/clean/preview", response_model=CleaningPreviewResponse)
def preview_cleaning_plan(
    dataset_id: str,
    plan: CleaningPlan,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> CleaningPreviewResponse:
    """Preview proposed cleaning plan operations in-memory without altering raw dataset file."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )
    _verify_dataset_project(dataset, project_id)
    df = DatasetService.load_dataset_dataframe(dataset)
    return CleaningService.preview_cleaning(df=df, dataset_id=dataset_id, plan=plan)


@router.post("/{dataset_id}/clean/apply", response_model=CleaningApplyResponse)
def apply_cleaning_plan(
    dataset_id: str,
    plan: CleaningPlan,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> CleaningApplyResponse:
    """Execute cleaning plan, store processed CSV into data/processed/, record audit logs, and re-profile."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )
    _verify_dataset_project(dataset, project_id)
    df = DatasetService.load_dataset_dataframe(dataset)
    return CleaningService.apply_cleaning(db=db, raw_dataset=dataset, raw_df=df, plan=plan)


@router.get("/{dataset_id}/transformations", response_model=TransformationHistoryResponse)
def get_transformation_history(
    dataset_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> TransformationHistoryResponse:
    """Fetch audit log history of transformations applied to a dataset."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )
    _verify_dataset_project(dataset, project_id)

    stmt = select(TransformationLog).where(
        (TransformationLog.dataset_id == dataset_id) | (TransformationLog.output_dataset_id == dataset_id)
    ).order_by(TransformationLog.created_at.asc())
    
    logs = db.scalars(stmt).all()
    items = [
        TransformationLogResponse(
            id=log.id,
            dataset_id=log.dataset_id,
            output_dataset_id=log.output_dataset_id,
            operation_type=log.operation_type,
            column_name=log.column_name,
            strategy=log.strategy,
            affected_rows=log.affected_rows,
            details=log.details,
            created_at=log.created_at,
        )
        for log in logs
    ]
    return TransformationHistoryResponse(dataset_id=dataset_id, total=len(items), items=items)


@router.get("/{dataset_id}/download")
def download_dataset_file(
    dataset_id: str,
    version: str = Query("raw", description="Dataset version to download: 'raw' or 'processed'"),
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
):
    """Safely stream CSV dataset file for download with explicit version selection ('raw' or 'processed')."""
    if version not in ("raw", "processed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid version parameter. Must be 'raw' or 'processed'."
        )

    target_dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not target_dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found."
        )
    _verify_dataset_project(target_dataset, project_id)

    # If requested version is processed, find child processed dataset or check if target is processed
    if version == "processed":
        if not target_dataset.is_processed:
            # Look for child processed dataset
            stmt = select(Dataset).where(
                Dataset.parent_id == dataset_id, Dataset.is_processed == True
            ).order_by(Dataset.created_at.desc())
            child = db.scalars(stmt).first()
            if child:
                target_dataset = child
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No processed version found for dataset '{dataset_id}'."
                )

    if not target_dataset.file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset file path not found."
        )

    try:
        file_bytes = storage_service.get_file_bytes(target_dataset.file_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset CSV file not found on disk."
        )

    filename = target_dataset.name or f"dataset_{dataset_id}.csv"
    if not filename.endswith(".csv"):
        filename += ".csv"

    return Response(
        content=file_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/{dataset_id}/versions", response_model=DatasetVersionListResponse)
def get_dataset_versions(
    dataset_id: str,
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> DatasetVersionListResponse:
    """Retrieve all available dataset versions within the same project/lineage."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )
    _verify_dataset_project(dataset, project_id)
    return DatasetComparisonService.get_dataset_versions(db, dataset_id)


@router.get("/{dataset_id}/compare/{other_dataset_id}", response_model=DatasetComparisonResponse)
def compare_dataset_versions(
    dataset_id: str,
    other_dataset_id: str,
    db: Session = Depends(get_db),
) -> DatasetComparisonResponse:
    """Compare two dataset versions and compute real statistical, schema, quality, and downstream impacts."""
    return DatasetComparisonService.compare_datasets(db, dataset_id, other_dataset_id)


@router.get("/{dataset_id}/runs", response_model=AnalysisRunListResponse)
def get_dataset_runs(
    dataset_id: str,
    run_type: Optional[str] = Query(None, description="Filter by run type (EDA, INSIGHTS, PREDICTION, etc.)"),
    status: Optional[str] = Query(None, description="Filter by status (RUNNING, COMPLETED, FAILED)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> AnalysisRunListResponse:
    """Retrieve analysis runs associated with a dataset (or its lineage/child) with optional filters."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )
    _verify_dataset_project(dataset, project_id)
    runs, total = AnalysisRunService.list_dataset_runs(
        db,
        dataset_id=dataset_id,
        run_type=run_type,
        status=status,
        limit=limit,
        offset=offset,
    )
    return AnalysisRunListResponse(
        runs=runs,
        total=total,
        dataset_id=dataset_id,
    )


@router.get("/{dataset_id}/insight-memory", response_model=InsightMemoryListResponse)
def get_dataset_insight_memory(
    dataset_id: str,
    status: Optional[str] = Query(None, description="Filter by status (NEW, PERSISTED, STRENGTHENED, WEAKENED, DISAPPEARED)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    project_id: Optional[str] = Query(None, description="Optional project ID for tenancy isolation validation"),
    db: Session = Depends(get_db),
) -> InsightMemoryListResponse:
    """Retrieve persistent Insight Memory records and timeline matrix for a dataset lineage."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )
    _verify_dataset_project(dataset, project_id)
    from app.services.insight_memory_service import InsightMemoryService
    return InsightMemoryService.list_dataset_memory(
        db, dataset_id=dataset_id, status_filter=status, category=category
    )



@router.get("/{base_id}/insight-impact/{comparison_id}", response_model=InsightImpactComparisonResponse)
def compare_dataset_insight_impact(
    base_id: str,
    comparison_id: str,
    db: Session = Depends(get_db),
) -> InsightImpactComparisonResponse:
    """Compare analytical insights between two dataset versions and assess impact on downstream decisions."""
    from app.services.insight_memory_service import InsightMemoryService
    return InsightMemoryService.compare_insight_impact(
        db, base_id=base_id, comp_id=comparison_id
    )



