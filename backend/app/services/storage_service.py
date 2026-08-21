import os
import re
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from app.core.config import settings
from app.core.logging import logger


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and remove unsafe characters."""
    # Strip path components
    basename = os.path.basename(filename)
    # Remove characters that aren't alphanumeric, dot, dash, or underscore
    clean = re.sub(r'[^a-zA-Z0-9._-]', '_', basename)
    return clean if clean else "uploaded_file.csv"


class StorageProvider(ABC):
    """Abstract Base Class for Dataset Storage Providers."""

    @abstractmethod
    def save_file(self, content: bytes, original_filename: str) -> tuple[str, str, int]:
        """Save file bytes and return (storage_key, sanitized_original_name, file_size_bytes)."""
        pass

    @abstractmethod
    def get_file_bytes(self, storage_key: str) -> bytes:
        """Retrieve stored file contents as bytes."""
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        """Delete stored file by key."""
        pass


class LocalStorageProvider(StorageProvider):
    """Local Filesystem Storage Provider saving files into data/raw and data/processed."""

    def __init__(self, target_dir: Path | None = None, processed_dir: Path | None = None):
        self.target_dir = target_dir or settings.upload_dir_path
        self.processed_dir = processed_dir or settings.processed_dir_path
        self.target_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def save_file(self, content: bytes, original_filename: str) -> tuple[str, str, int]:
        sanitized_name = sanitize_filename(original_filename)
        file_ext = os.path.splitext(sanitized_name)[1].lower() or ".csv"
        
        # Unique internal filename
        internal_filename = f"{uuid.uuid4()}{file_ext}"
        destination_path = self.target_dir / internal_filename
        
        with open(destination_path, "wb") as f:
            f.write(content)
        
        file_size = len(content)
        storage_key = f"data/raw/{internal_filename}"
        
        logger.info(f"Saved raw file '{sanitized_name}' ({file_size} bytes) to '{storage_key}'")
        return storage_key, sanitized_name, file_size

    def save_processed_file(self, content: bytes, original_filename: str) -> tuple[str, str, int]:
        sanitized_name = sanitize_filename(original_filename)
        file_ext = os.path.splitext(sanitized_name)[1].lower() or ".csv"
        
        internal_filename = f"{uuid.uuid4()}{file_ext}"
        destination_path = self.processed_dir / internal_filename
        
        with open(destination_path, "wb") as f:
            f.write(content)
        
        file_size = len(content)
        storage_key = f"data/processed/{internal_filename}"
        
        logger.info(f"Saved processed file '{sanitized_name}' ({file_size} bytes) to '{storage_key}'")
        return storage_key, sanitized_name, file_size

    def resolve_path(self, storage_key: str) -> Path:
        filename = os.path.basename(storage_key)
        if "processed" in storage_key:
            full_path = self.processed_dir / filename
        else:
            full_path = self.target_dir / filename
        if not full_path.exists():
            # Fallback checks
            raw_path = self.target_dir / filename
            proc_path = self.processed_dir / filename
            if raw_path.exists():
                return raw_path
            elif proc_path.exists():
                return proc_path
            raise FileNotFoundError(f"Storage object '{storage_key}' not found.")
        return full_path

    def get_file_bytes(self, storage_key: str) -> bytes:
        full_path = self.resolve_path(storage_key)
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


# Default storage singleton instance
storage_service = LocalStorageProvider()

