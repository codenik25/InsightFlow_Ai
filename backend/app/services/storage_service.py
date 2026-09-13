import os
import re
import uuid
import io
import tempfile
import joblib
from abc import ABC, abstractmethod
from typing import Any, Tuple
from pathlib import Path
from app.core.config import settings
from app.core.logging import logger

try:
    from supabase import create_client, Client
except ImportError:
    pass  # Handled below


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and remove unsafe characters."""
    basename = os.path.basename(filename)
    clean = re.sub(r'[^a-zA-Z0-9._-]', '_', basename)
    return clean if clean else "uploaded_file.csv"


class StorageProvider(ABC):
    """Abstract Base Class for Dataset and ML Artifact Storage Providers."""

    @abstractmethod
    def save_file(self, content: bytes, original_filename: str, dataset_id: str | None = None) -> tuple[str, str, int]:
        """Save file bytes and return (storage_key, sanitized_original_name, file_size_bytes)."""
        pass

    @abstractmethod
    def save_processed_file(self, content: bytes, original_filename: str, dataset_id: str | None = None) -> tuple[str, str, int]:
        """Save processed file bytes."""
        pass

    @abstractmethod
    def get_file_bytes(self, storage_key: str) -> bytes:
        """Retrieve stored file contents as bytes."""
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        """Delete stored file by key."""
        pass

    @abstractmethod
    def save_model(self, model: Any, analysis_id: str) -> str:
        """Save an ML model (e.g. scikit-learn pipeline via joblib) and return storage_key."""
        pass

    @abstractmethod
    def load_model(self, storage_key: str) -> Any:
        """Load an ML model from the given storage_key."""
        pass


class LocalStorageProvider(StorageProvider):
    """Local Filesystem Storage Provider saving files into data/raw, data/processed, and data/models."""

    def __init__(self, target_dir: Path | None = None, processed_dir: Path | None = None, models_dir: Path | None = None):
        self.target_dir = target_dir or settings.upload_dir_path
        self.processed_dir = processed_dir or settings.processed_dir_path
        self.models_dir = models_dir or settings.models_dir_path
        self.target_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.models_dir.mkdir(parents=True, exist_ok=True)

    def save_file(self, content: bytes, original_filename: str, dataset_id: str | None = None) -> tuple[str, str, int]:
        sanitized_name = sanitize_filename(original_filename)
        file_ext = os.path.splitext(sanitized_name)[1].lower() or ".csv"
        
        internal_filename = f"{dataset_id}{file_ext}" if dataset_id else f"{uuid.uuid4()}{file_ext}"
        destination_path = self.target_dir / internal_filename
        
        with open(destination_path, "wb") as f:
            f.write(content)
        
        file_size = len(content)
        storage_key = f"raw/{internal_filename}"
        
        logger.info(f"Saved raw file '{sanitized_name}' ({file_size} bytes) to '{storage_key}'")
        return storage_key, sanitized_name, file_size

    def save_processed_file(self, content: bytes, original_filename: str, dataset_id: str | None = None) -> tuple[str, str, int]:
        sanitized_name = sanitize_filename(original_filename)
        file_ext = os.path.splitext(sanitized_name)[1].lower() or ".csv"
        
        internal_filename = f"{dataset_id}{file_ext}" if dataset_id else f"{uuid.uuid4()}{file_ext}"
        destination_path = self.processed_dir / internal_filename
        
        with open(destination_path, "wb") as f:
            f.write(content)
        
        file_size = len(content)
        storage_key = f"processed/{internal_filename}"
        
        logger.info(f"Saved processed file '{sanitized_name}' ({file_size} bytes) to '{storage_key}'")
        return storage_key, sanitized_name, file_size

    def resolve_path(self, storage_key: str) -> Path:
        # Backward compatibility with existing keys like 'data/raw/uuid'
        clean_key = storage_key.replace("data/", "")
        
        if clean_key.startswith("processed/"):
            return self.processed_dir / clean_key.split("/")[-1]
        elif clean_key.startswith("raw/"):
            return self.target_dir / clean_key.split("/")[-1]
        elif clean_key.startswith("models/"):
            return self.models_dir / clean_key.split("/")[-1]
        else:
            # Fallback for old keys without prefix
            filename = os.path.basename(storage_key)
            for path in [self.target_dir, self.processed_dir, self.models_dir]:
                full_path = path / filename
                if full_path.exists():
                    return full_path
            return self.target_dir / filename

    def get_file_bytes(self, storage_key: str) -> bytes:
        full_path = self.resolve_path(storage_key)
        if not full_path.exists():
            raise FileNotFoundError(f"Storage object '{storage_key}' not found.")
        with open(full_path, "rb") as f:
            return f.read()

    def delete_file(self, storage_key: str) -> bool:
        try:
            full_path = self.resolve_path(storage_key)
            if full_path.exists():
                full_path.unlink()
                return True
        except FileNotFoundError:
            pass
        return False

    def save_model(self, model: Any, analysis_id: str) -> str:
        filename = f"{analysis_id}.joblib"
        destination_path = self.models_dir / filename
        joblib.dump(model, str(destination_path))
        storage_key = f"models/{analysis_id}/{filename}"
        logger.info(f"Saved ML model for analysis '{analysis_id}' to '{storage_key}'")
        return storage_key

    def load_model(self, storage_key: str) -> Any:
        full_path = self.resolve_path(storage_key)
        if not full_path.exists():
            raise FileNotFoundError(f"Model object '{storage_key}' not found.")
        return joblib.load(str(full_path))


class SupabaseStorageProvider(StorageProvider):
    """Supabase Storage Provider utilizing insightflow-datasets and insightflow-models buckets."""

    def __init__(self):
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise ValueError("Supabase configuration is missing.")
        
        self.client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        self.datasets_bucket = "insightflow-datasets"
        self.models_bucket = "insightflow-models"

    def _safe_upload(self, bucket: str, path: str, content: bytes, file_options: dict) -> None:
        try:
            # Upsert is safer for avoiding collisions
            self.client.storage.from_(bucket).upload(path, content, file_options)
        except Exception as e:
            if "Duplicate" in str(e) or "already exists" in str(e).lower():
                self.client.storage.from_(bucket).update(path, content, file_options)
            else:
                logger.error(f"Failed to upload to Supabase: {str(e)}")
                raise

    def save_file(self, content: bytes, original_filename: str, dataset_id: str | None = None) -> tuple[str, str, int]:
        sanitized_name = sanitize_filename(original_filename)
        file_ext = os.path.splitext(sanitized_name)[1].lower() or ".csv"
        
        internal_filename = f"{dataset_id}{file_ext}" if dataset_id else f"{uuid.uuid4()}{file_ext}"
        storage_key = f"raw/{dataset_id or 'unknown'}/{internal_filename}"
        
        self._safe_upload(
            self.datasets_bucket, 
            storage_key, 
            content, 
            file_options={"content-type": "text/csv"}
        )
        
        file_size = len(content)
        logger.info(f"Saved raw file '{sanitized_name}' ({file_size} bytes) to Supabase '{storage_key}'")
        return storage_key, sanitized_name, file_size

    def save_processed_file(self, content: bytes, original_filename: str, dataset_id: str | None = None) -> tuple[str, str, int]:
        sanitized_name = sanitize_filename(original_filename)
        file_ext = os.path.splitext(sanitized_name)[1].lower() or ".csv"
        
        internal_filename = f"{dataset_id}{file_ext}" if dataset_id else f"{uuid.uuid4()}{file_ext}"
        storage_key = f"processed/{dataset_id or 'unknown'}/{internal_filename}"
        
        self._safe_upload(
            self.datasets_bucket, 
            storage_key, 
            content, 
            file_options={"content-type": "text/csv"}
        )
        
        file_size = len(content)
        logger.info(f"Saved processed file '{sanitized_name}' ({file_size} bytes) to Supabase '{storage_key}'")
        return storage_key, sanitized_name, file_size

    def get_file_bytes(self, storage_key: str) -> bytes:
        try:
            # Handle legacy keys
            clean_key = storage_key.replace("data/", "")
            res = self.client.storage.from_(self.datasets_bucket).download(clean_key)
            return res
        except Exception as e:
            logger.error(f"Failed to download '{storage_key}' from Supabase: {str(e)}")
            raise FileNotFoundError(f"Storage object '{storage_key}' not found in Supabase.") from e

    def delete_file(self, storage_key: str) -> bool:
        try:
            clean_key = storage_key.replace("data/", "")
            self.client.storage.from_(self.datasets_bucket).remove([clean_key])
            return True
        except Exception:
            return False

    def save_model(self, model: Any, analysis_id: str) -> str:
        filename = f"{analysis_id}.joblib"
        storage_key = f"models/{analysis_id}/{filename}"
        
        fd, temp_path = tempfile.mkstemp(suffix=".joblib")
        os.close(fd)
        
        try:
            joblib.dump(model, temp_path)
            with open(temp_path, "rb") as f:
                content = f.read()
            self._safe_upload(
                self.models_bucket,
                storage_key,
                content,
                file_options={"content-type": "application/octet-stream"}
            )
            logger.info(f"Saved ML model for analysis '{analysis_id}' to Supabase '{storage_key}'")
            return storage_key
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def load_model(self, storage_key: str) -> Any:
        try:
            clean_key = storage_key.replace("data/", "")
            content = self.client.storage.from_(self.models_bucket).download(clean_key)
        except Exception as e:
            logger.error(f"Failed to download model '{storage_key}' from Supabase: {str(e)}")
            raise FileNotFoundError(f"Model object '{storage_key}' not found in Supabase.") from e

        fd, temp_path = tempfile.mkstemp(suffix=".joblib")
        os.close(fd)
        
        try:
            with open(temp_path, "wb") as f:
                f.write(content)
            return joblib.load(temp_path)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


def get_storage_service() -> StorageProvider:
    if settings.STORAGE_BACKEND == "supabase":
        logger.info("Initializing SupabaseStorageProvider")
        return SupabaseStorageProvider()
    else:
        logger.info("Initializing LocalStorageProvider")
        return LocalStorageProvider()


# Default storage singleton instance
storage_service = get_storage_service()
