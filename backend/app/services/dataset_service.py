import io
import uuid
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings
from app.core.logging import logger
from app.models.dataset import Dataset
from app.schemas.dataset import DatasetCreate
from app.schemas.profile import DatasetProfileResponse
from app.services.storage_service import storage_service
from app.services.profiling_service import ProfilingService


class DatasetService:
    @staticmethod
    def list_datasets(db: Session, skip: int = 0, limit: int = 100) -> list[Dataset]:
        """Fetch list of metadata for stored datasets."""
        stmt = select(Dataset).offset(skip).limit(limit).order_by(Dataset.created_at.desc())
        return list(db.scalars(stmt).all())

    @staticmethod
    def count_datasets(db: Session) -> int:
        """Count total dataset entries."""
        stmt = select(Dataset)
        return len(list(db.scalars(stmt).all()))

    @staticmethod
    def get_dataset_by_id(db: Session, dataset_id: str) -> Dataset | None:
        """Fetch dataset metadata by ID, returning None if not found."""
        stmt = select(Dataset).where(Dataset.id == dataset_id)
        return db.scalar(stmt)

    @staticmethod
    def load_dataset_dataframe(dataset: Dataset) -> pd.DataFrame:
        """Load stored CSV bytes for a dataset record into a Pandas DataFrame."""
        if not dataset.file_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dataset '{dataset.id}' has no associated file path."
            )
        try:
            content_bytes = storage_service.get_file_bytes(dataset.file_path)
            decoded = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            decoded = content_bytes.decode("latin-1")
        except FileNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Storage object for dataset '{dataset.id}' not found."
            )

        try:
            df = pd.read_csv(io.StringIO(decoded))
            return df
        except Exception as exc:
            logger.error(f"Failed to parse stored CSV for dataset '{dataset.id}': {str(exc)}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to parse CSV content for dataset '{dataset.id}'."
            )


    @staticmethod
    def create_dataset_metadata(db: Session, data: DatasetCreate) -> Dataset:
        """Create new dataset metadata entry."""
        dataset = Dataset(**data.model_dump())
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        return dataset

    @classmethod
    def ingest_and_profile_csv(cls, db: Session, file: UploadFile) -> DatasetProfileResponse:
        """Validate, store, parse, profile, and persist CSV file."""
        if not file or not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided in upload request."
            )

        filename = file.filename
        if not filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file format '{filename}'. Only CSV files (.csv) are supported in Phase 1."
            )

        # Read content bytes into memory for validation
        try:
            content = file.file.read()
        except Exception as exc:
            logger.error(f"Failed to read upload stream: {str(exc)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to read uploaded file content stream."
            )

        file_size = len(content)
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes)."
            )

        if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
            max_mb = settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size ({round(file_size / (1024*1024), 2)} MB) exceeds maximum allowed limit of {max_mb} MB."
            )

        # Decode content with UTF-8 fallback to Latin-1
        try:
            decoded_text = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                decoded_text = content.decode("latin-1")
            except Exception as exc:
                logger.error(f"File encoding error for '{filename}': {str(exc)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File encoding error. Please ensure file is UTF-8 or Latin-1 encoded."
                )

        # Parse CSV into Pandas DataFrame
        try:
            df = pd.read_csv(io.StringIO(decoded_text))
        except pd.errors.EmptyDataError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded CSV file contains no tabular data or columns."
            )
        except Exception as exc:
            logger.warning(f"Pandas CSV parse error for '{filename}': {str(exc)}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Malformed CSV structure. Unable to parse tabular columns and rows."
            )

        if len(df.columns) == 0 or len(df) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset is empty. CSV must contain at least 1 row and 1 header column."
            )

        # Save file via storage service abstraction (data/raw/<uuid>.csv)
        storage_key, sanitized_original_name, _ = storage_service.save_file(content, filename)

        dataset_id = str(uuid.uuid4())
        total_rows = len(df)
        total_cols = len(df.columns)

        # Generate automated profile using ProfilingService
        profile = ProfilingService.profile_dataframe(
            df=df,
            dataset_id=dataset_id,
            filename=sanitized_original_name,
            file_size_bytes=file_size,
        )

        # Persist Dataset record into Database
        dataset_record = Dataset(
            id=dataset_id,
            name=sanitized_original_name,
            description=f"CSV Dataset uploaded on {filename}",
            file_path=storage_key,
            file_size_bytes=file_size,
            row_count=total_rows,
            column_count=total_cols,
            mime_type="text/csv",
            status="profiled",
            profile_data=profile.model_dump(),
        )

        db.add(dataset_record)
        db.commit()
        db.refresh(dataset_record)

        logger.info(f"Dataset '{sanitized_original_name}' (ID: {dataset_id}) successfully uploaded & profiled ({total_rows} rows, {total_cols} cols).")
        return profile
