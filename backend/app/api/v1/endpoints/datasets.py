from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response, status
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
from app.services.dataset_service import DatasetService
from app.services.quality_service import QualityService
from app.services.cleaning_service import CleaningService
from app.services.storage_service import storage_service

router = APIRouter()


@router.get("", response_model=DatasetListResponse)
def list_datasets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> DatasetListResponse:
    """Retrieve list of registered dataset metadata items."""
    try:
        items = DatasetService.list_datasets(db=db, skip=skip, limit=limit)
        total = DatasetService.count_datasets(db=db)
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
    db: Session = Depends(get_db),
) -> DatasetProfileResponse:
    """Upload a CSV dataset, parse schema, compute automated data profile, and store metadata."""
    try:
        return DatasetService.ingest_and_profile_csv(db=db, file=file)
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
    db: Session = Depends(get_db),
) -> DatasetResponse:
    """Get metadata for a specific dataset by ID."""
    try:
        dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset with ID '{dataset_id}' not found.",
            )
        return dataset
    except OperationalError as exc:
        logger.warning(f"Database operational error in dataset retrieval: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service currently unavailable. Please verify PostgreSQL container is running.",
        )


@router.get("/{dataset_id}/profile", response_model=DatasetProfileResponse)
def get_dataset_profile(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> DatasetProfileResponse:
    """Retrieve saved data profile for a dataset by ID."""
    try:
        dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset with ID '{dataset_id}' not found.",
            )
        if not dataset.profile_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No profile data found for dataset '{dataset_id}'.",
            )
        return DatasetProfileResponse(**dataset.profile_data)
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
    db: Session = Depends(get_db),
) -> DatasetQualityResponse:
    """Evaluate and retrieve 5-part data quality metrics & 0-100 score for a dataset."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )
    df = DatasetService.load_dataset_dataframe(dataset)
    return QualityService.evaluate_quality(df=df, dataset_id=dataset_id)


@router.post("/{dataset_id}/quality", response_model=DatasetQualityResponse)
def compute_dataset_quality(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> DatasetQualityResponse:
    """Post alias for dataset quality evaluation."""
    return get_dataset_quality(dataset_id=dataset_id, db=db)


@router.post("/{dataset_id}/clean/preview", response_model=CleaningPreviewResponse)
def preview_cleaning_plan(
    dataset_id: str,
    plan: CleaningPlan,
    db: Session = Depends(get_db),
) -> CleaningPreviewResponse:
    """Preview proposed cleaning plan operations in-memory without altering raw dataset file."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )
    df = DatasetService.load_dataset_dataframe(dataset)
    return CleaningService.preview_cleaning(df=df, dataset_id=dataset_id, plan=plan)


@router.post("/{dataset_id}/clean/apply", response_model=CleaningApplyResponse)
def apply_cleaning_plan(
    dataset_id: str,
    plan: CleaningPlan,
    db: Session = Depends(get_db),
) -> CleaningApplyResponse:
    """Execute cleaning plan, store processed CSV into data/processed/, record audit logs, and re-profile."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )
    df = DatasetService.load_dataset_dataframe(dataset)
    return CleaningService.apply_cleaning(db=db, raw_dataset=dataset, raw_df=df, plan=plan)


@router.get("/{dataset_id}/transformations", response_model=TransformationHistoryResponse)
def get_transformation_history(
    dataset_id: str,
    db: Session = Depends(get_db),
) -> TransformationHistoryResponse:
    """Fetch audit log history of transformations applied to a dataset."""
    dataset = DatasetService.get_dataset_by_id(db=db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset with ID '{dataset_id}' not found.",
        )

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

