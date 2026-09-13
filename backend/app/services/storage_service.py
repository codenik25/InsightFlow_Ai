import os
import re
import uuid
import tempfile
import joblib

from abc import ABC, abstractmethod
from typing import Any
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger


try:
    from supabase import create_client
except ImportError:
    create_client = None


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal
    and remove unsafe characters.
    """

    basename = os.path.basename(filename)

    clean = re.sub(
        r"[^a-zA-Z0-9._-]",
        "_",
        basename
    )

    return clean if clean else "uploaded_file.csv"


class StorageProvider(ABC):
    """
    Abstract base class for dataset and ML artifact storage.
    """

    @abstractmethod
    def save_file(
        self,
        content: bytes,
        original_filename: str,
        dataset_id: str | None = None
    ) -> tuple[str, str, int]:
        pass

    @abstractmethod
    def save_processed_file(
        self,
        content: bytes,
        original_filename: str,
        dataset_id: str | None = None
    ) -> tuple[str, str, int]:
        pass

    @abstractmethod
    def get_file_bytes(
        self,
        storage_key: str
    ) -> bytes:
        pass

    @abstractmethod
    def delete_file(
        self,
        storage_key: str
    ) -> bool:
        pass

    @abstractmethod
    def save_model(
        self,
        model: Any,
        analysis_id: str
    ) -> str:
        pass

    @abstractmethod
    def load_model(
        self,
        storage_key: str
    ) -> Any:
        pass


# ============================================================
# LOCAL STORAGE
# ============================================================

class LocalStorageProvider(StorageProvider):

    def __init__(
        self,
        target_dir: Path | None = None,
        processed_dir: Path | None = None,
        models_dir: Path | None = None
    ):

        self.target_dir = (
            target_dir
            or settings.upload_dir_path
        )

        self.processed_dir = (
            processed_dir
            or settings.processed_dir_path
        )

        self.models_dir = (
            models_dir
            or settings.models_dir_path
        )

        self.target_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        self.processed_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        self.models_dir.mkdir(
            parents=True,
            exist_ok=True
        )


    def save_file(
        self,
        content: bytes,
        original_filename: str,
        dataset_id: str | None = None
    ) -> tuple[str, str, int]:

        sanitized_name = sanitize_filename(
            original_filename
        )

        file_ext = (
            os.path.splitext(sanitized_name)[1].lower()
            or ".csv"
        )

        internal_filename = (
            f"{dataset_id}{file_ext}"
            if dataset_id
            else f"{uuid.uuid4()}{file_ext}"
        )

        destination_path = (
            self.target_dir
            / internal_filename
        )

        with open(
            destination_path,
            "wb"
        ) as file:

            file.write(content)


        file_size = len(content)

        storage_key = (
            f"raw/{internal_filename}"
        )

        logger.info(
            f"Saved raw file "
            f"'{sanitized_name}' "
            f"({file_size} bytes) "
            f"to '{storage_key}'"
        )

        return (
            storage_key,
            sanitized_name,
            file_size
        )


    def save_processed_file(
        self,
        content: bytes,
        original_filename: str,
        dataset_id: str | None = None
    ) -> tuple[str, str, int]:

        sanitized_name = sanitize_filename(
            original_filename
        )

        file_ext = (
            os.path.splitext(sanitized_name)[1].lower()
            or ".csv"
        )

        internal_filename = (
            f"{dataset_id}{file_ext}"
            if dataset_id
            else f"{uuid.uuid4()}{file_ext}"
        )

        destination_path = (
            self.processed_dir
            / internal_filename
        )

        with open(
            destination_path,
            "wb"
        ) as file:

            file.write(content)


        file_size = len(content)

        storage_key = (
            f"processed/{internal_filename}"
        )

        logger.info(
            f"Saved processed file "
            f"'{sanitized_name}' "
            f"({file_size} bytes)"
        )

        return (
            storage_key,
            sanitized_name,
            file_size
        )


    def resolve_path(
        self,
        storage_key: str
    ) -> Path:

        clean_key = storage_key.replace(
            "data/",
            ""
        )


        if clean_key.startswith(
            "processed/"
        ):

            return (
                self.processed_dir
                / clean_key.split("/")[-1]
            )


        elif clean_key.startswith(
            "raw/"
        ):

            return (
                self.target_dir
                / clean_key.split("/")[-1]
            )


        elif clean_key.startswith(
            "models/"
        ):

            return (
                self.models_dir
                / clean_key.split("/")[-1]
            )


        else:

            filename = os.path.basename(
                storage_key
            )

            for directory in [
                self.target_dir,
                self.processed_dir,
                self.models_dir
            ]:

                full_path = (
                    directory
                    / filename
                )

                if full_path.exists():

                    return full_path


            return (
                self.target_dir
                / filename
            )


    def get_file_bytes(
        self,
        storage_key: str
    ) -> bytes:

        full_path = self.resolve_path(
            storage_key
        )


        if not full_path.exists():

            raise FileNotFoundError(
                f"Storage object "
                f"'{storage_key}' not found."
            )


        with open(
            full_path,
            "rb"
        ) as file:

            return file.read()


    def delete_file(
        self,
        storage_key: str
    ) -> bool:

        try:

            full_path = self.resolve_path(
                storage_key
            )


            if full_path.exists():

                full_path.unlink()

                return True


        except Exception as exc:

            logger.error(
                f"Failed to delete "
                f"'{storage_key}': {exc}"
            )


        return False


    def save_model(
        self,
        model: Any,
        analysis_id: str
    ) -> str:

        filename = (
            f"{analysis_id}.joblib"
        )

        destination_path = (
            self.models_dir
            / filename
        )


        joblib.dump(
            model,
            str(destination_path)
        )


        storage_key = (
            f"models/{filename}"
        )


        logger.info(
            f"Saved ML model "
            f"'{analysis_id}'"
        )


        return storage_key


    def load_model(
        self,
        storage_key: str
    ) -> Any:

        full_path = self.resolve_path(
            storage_key
        )


        if not full_path.exists():

            raise FileNotFoundError(
                f"Model '{storage_key}' "
                f"not found."
            )


        return joblib.load(
            str(full_path)
        )


# ============================================================
# SUPABASE STORAGE
# ============================================================

class SupabaseStorageProvider(StorageProvider):

    def __init__(self):

        if create_client is None:

            raise ImportError(
                "Supabase package is not installed."
            )


        if (
            not settings.SUPABASE_URL
            or
            not settings.SUPABASE_SERVICE_KEY
        ):

            raise ValueError(
                "SUPABASE_URL and "
                "SUPABASE_SERVICE_KEY "
                "are required."
            )


        logger.info(
            "Initializing Supabase Storage"
        )


        self.client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY
        )


        self.datasets_bucket = (
            "insightflow-datasets"
        )

        self.models_bucket = (
            "insightflow-models"
        )


    def _safe_upload(
        self,
        bucket: str,
        path: str,
        content: bytes,
        content_type: str
    ) -> None:

        try:
            # Verify bucket existence to provide clear error message
            try:
                buckets = self.client.storage.list_buckets()
                if not any(b.name == bucket for b in buckets):
                    logger.error(f"Bucket '{bucket}' does not exist in Supabase.")
                    raise ValueError(f"Bucket '{bucket}' does not exist.")
            except Exception as bucket_exc:
                if isinstance(bucket_exc, ValueError):
                    raise bucket_exc
                logger.warning(f"Failed to verify bucket existence, proceeding anyway: {bucket_exc}")

            bucket_client = (
                self.client.storage.from_(
                    bucket
                )
            )

            logger.info(
                f"Uploading to Supabase: "
                f"bucket={bucket}, "
                f"path={path}, "
                f"size={len(content)} bytes"
            )

            response = bucket_client.upload(
                path=path,
                file=content,
                file_options={
                    "content-type": content_type,
                    "x-upsert": "true"
                }
            )

            logger.info(
                f"Supabase upload successful: "
                f"{response}"
            )

        except AttributeError as attr_exc:
            logger.exception(
                f"Supabase upload failed due to a known storage3 library bug. "
                f"Bucket: {bucket}, Path: {path}. "
                f"This usually means the bucket doesn't exist or RLS rejected it."
            )
            raise RuntimeError(
                f"Failed to upload file to Supabase Storage. "
                f"Storage3 Bug Encountered. Bucket='{bucket}', Path='{path}'"
            ) from attr_exc

        except Exception as exc:
            logger.exception(
                f"Supabase upload failed. "
                f"Bucket: {bucket}, "
                f"Path: {path}"
            )
            raise RuntimeError(
                f"Failed to upload file to "
                f"Supabase Storage. "
                f"Bucket='{bucket}', "
                f"Path='{path}', "
                f"Error='{str(exc)}'"
            ) from exc


    def save_file(
        self,
        content: bytes,
        original_filename: str,
        dataset_id: str | None = None
    ) -> tuple[str, str, int]:

        sanitized_name = sanitize_filename(
            original_filename
        )


        file_ext = (
            os.path.splitext(sanitized_name)[1].lower()
            or ".csv"
        )


        internal_filename = (
            f"{dataset_id}{file_ext}"
            if dataset_id
            else f"{uuid.uuid4()}{file_ext}"
        )


        storage_key = (
            f"raw/{dataset_id or 'unknown'}"
            f"/{internal_filename}"
        )


        self._safe_upload(

            bucket=self.datasets_bucket,

            path=storage_key,

            content=content,

            content_type="text/csv"
        )


        file_size = len(content)


        logger.info(
            f"Saved dataset "
            f"'{sanitized_name}' "
            f"to Supabase: "
            f"'{storage_key}'"
        )


        return (
            storage_key,
            sanitized_name,
            file_size
        )


    def save_processed_file(
        self,
        content: bytes,
        original_filename: str,
        dataset_id: str | None = None
    ) -> tuple[str, str, int]:

        sanitized_name = sanitize_filename(
            original_filename
        )


        file_ext = (
            os.path.splitext(sanitized_name)[1].lower()
            or ".csv"
        )


        internal_filename = (
            f"{dataset_id}{file_ext}"
            if dataset_id
            else f"{uuid.uuid4()}{file_ext}"
        )


        storage_key = (
            f"processed/{dataset_id or 'unknown'}"
            f"/{internal_filename}"
        )


        self._safe_upload(

            bucket=self.datasets_bucket,

            path=storage_key,

            content=content,

            content_type="text/csv"
        )


        file_size = len(content)


        logger.info(
            f"Saved processed dataset "
            f"to Supabase: "
            f"'{storage_key}'"
        )


        return (
            storage_key,
            sanitized_name,
            file_size
        )


    def get_file_bytes(
        self,
        storage_key: str
    ) -> bytes:

        try:

            clean_key = (
                storage_key.replace(
                    "data/",
                    ""
                )
            )


            response = (
                self.client
                .storage
                .from_(
                    self.datasets_bucket
                )
                .download(
                    clean_key
                )
            )


            return response


        except Exception as exc:

            logger.exception(
                f"Failed to download "
                f"'{storage_key}'"
            )


            raise FileNotFoundError(
                f"Storage object "
                f"'{storage_key}' "
                f"not found."
            ) from exc


    def delete_file(
        self,
        storage_key: str
    ) -> bool:

        try:

            clean_key = (
                storage_key.replace(
                    "data/",
                    ""
                )
            )


            self.client.storage.from_(
                self.datasets_bucket
            ).remove([
                clean_key
            ])


            logger.info(
                f"Deleted Supabase file: "
                f"{clean_key}"
            )


            return True


        except Exception as exc:

            logger.error(
                f"Failed to delete "
                f"'{storage_key}': "
                f"{str(exc)}"
            )


            return False


    def save_model(
        self,
        model: Any,
        analysis_id: str
    ) -> str:

        filename = (
            f"{analysis_id}.joblib"
        )


        storage_key = (
            f"models/{filename}"
        )


        fd, temp_path = (
            tempfile.mkstemp(
                suffix=".joblib"
            )
        )

        os.close(fd)


        try:

            joblib.dump(
                model,
                temp_path
            )


            with open(
                temp_path,
                "rb"
            ) as file:

                content = file.read()


            self._safe_upload(

                bucket=self.models_bucket,

                path=storage_key,

                content=content,

                content_type=(
                    "application/"
                    "octet-stream"
                )
            )


            logger.info(
                f"Saved ML model "
                f"'{analysis_id}' "
                f"to Supabase"
            )


            return storage_key


        finally:

            if os.path.exists(
                temp_path
            ):

                os.remove(
                    temp_path
                )


    def load_model(
        self,
        storage_key: str
    ) -> Any:

        try:

            content = (
                self.client
                .storage
                .from_(
                    self.models_bucket
                )
                .download(
                    storage_key
                )
            )


        except Exception as exc:

            logger.exception(
                f"Failed to download model "
                f"'{storage_key}'"
            )


            raise FileNotFoundError(
                f"Model '{storage_key}' "
                f"not found."
            ) from exc


        fd, temp_path = (
            tempfile.mkstemp(
                suffix=".joblib"
            )
        )

        os.close(fd)


        try:

            with open(
                temp_path,
                "wb"
            ) as file:

                file.write(
                    content
                )


            return joblib.load(
                temp_path
            )


        finally:

            if os.path.exists(
                temp_path
            ):

                os.remove(
                    temp_path
                )


# ============================================================
# STORAGE SERVICE FACTORY
# ============================================================

def get_storage_service() -> StorageProvider:

    backend = (
        settings.STORAGE_BACKEND
        .lower()
        .strip()
    )


    if backend == "supabase":

        logger.info(
            "Using SupabaseStorageProvider"
        )

        return SupabaseStorageProvider()


    logger.info(
        "Using LocalStorageProvider"
    )


    return LocalStorageProvider()


# ============================================================
# DEFAULT STORAGE INSTANCE
# ============================================================

storage_service = (
    get_storage_service()
)