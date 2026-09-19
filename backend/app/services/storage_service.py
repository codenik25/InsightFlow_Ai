import os
import re
import uuid
import tempfile
import joblib
import httpx
from urllib.parse import quote

from abc import ABC, abstractmethod
from typing import Any
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger


# Supabase python SDK `storage3` is unreliable and throws `AttributeError: 'dict' object has no attribute 'text'`.
# We bypass the SDK completely and use httpx for direct REST API communication.

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
            f"data/raw/{internal_filename}"
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
            f"data/processed/{internal_filename}"
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


        # self.client is removed, we use httpx directly.

        self.datasets_bucket = (
            "insightflow-datasets"
        )

        self.models_bucket = (
            "insightflow-models"
        )


    @property
    def _base_url(self) -> str:
        base = (settings.SUPABASE_URL or "").strip().rstrip("/")
        if base.endswith("/rest/v1"):
            base = base[:-len("/rest/v1")].rstrip("/")
        return base


    def _safe_upload(
        self,
        bucket: str,
        path: str,
        content: bytes,
        content_type: str
    ) -> None:

        base_url = self._base_url
        encoded_bucket = quote(bucket, safe="")
        encoded_path = quote(path, safe="/")
        url = f"{base_url}/storage/v1/object/{encoded_bucket}/{encoded_path}"

        headers = {
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Content-Type": content_type,
            "x-upsert": "true",
        }

        logger.info(
            f"Uploading to Supabase REST API: "
            f"bucket={bucket}, "
            f"path={path}, "
            f"size={len(content)} bytes"
        )

        try:
            response = httpx.post(url, headers=headers, content=content, timeout=60.0)

            if not response.is_success:
                logger.error(
                    f"Supabase REST API upload failed. "
                    f"Status Code: {response.status_code}, "
                    f"Response Body: {response.text}, "
                    f"Bucket: {bucket}, "
                    f"Path: {path}"
                )
                raise RuntimeError(
                    f"Failed to upload file to Supabase Storage REST API. "
                    f"Status Code={response.status_code}, "
                    f"Bucket='{bucket}', "
                    f"Path='{path}', "
                    f"Response='{response.text}'"
                )

            logger.info(
                f"Supabase REST API upload successful: "
                f"Status Code: {response.status_code}"
            )

        except httpx.RequestError as exc:
            logger.exception(
                f"Network error while communicating with Supabase Storage. "
                f"Bucket: {bucket}, Path: {path}"
            )
            raise RuntimeError(
                f"Network error communicating with Supabase Storage REST API. "
                f"Bucket='{bucket}', Path='{path}', Error='{str(exc)}'"
            ) from exc
        except RuntimeError:
            raise
        except Exception as exc:
            logger.exception(
                f"Unexpected error during Supabase REST API upload. "
                f"Bucket: {bucket}, Path: {path}"
            )
            raise RuntimeError(
                f"Unexpected error communicating with Supabase Storage REST API. "
                f"Bucket='{bucket}', Path='{path}', Error='{str(exc)}'"
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

            base_url = self._base_url
            encoded_bucket = quote(self.datasets_bucket, safe="")
            encoded_path = quote(clean_key, safe="/")
            url = f"{base_url}/storage/v1/object/{encoded_bucket}/{encoded_path}"

            headers = {
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "apikey": settings.SUPABASE_SERVICE_KEY,
            }

            response = httpx.get(url, headers=headers, timeout=60.0)

            if not response.is_success:
                logger.error(
                    f"Supabase REST API download failed. "
                    f"Status Code: {response.status_code}, "
                    f"Bucket: {self.datasets_bucket}, "
                    f"Path: {clean_key}"
                )
                raise FileNotFoundError(
                    f"Storage object '{storage_key}' not found."
                )

            return response.content

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

            base_url = self._base_url
            encoded_bucket = quote(self.datasets_bucket, safe="")
            encoded_path = quote(clean_key, safe="/")
            url = f"{base_url}/storage/v1/object/{encoded_bucket}/{encoded_path}"

            headers = {
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "apikey": settings.SUPABASE_SERVICE_KEY,
            }

            response = httpx.delete(url, headers=headers, timeout=30.0)

            if not response.is_success:
                logger.error(
                    f"Supabase REST API delete failed. "
                    f"Status Code: {response.status_code}, "
                    f"Bucket: {self.datasets_bucket}, "
                    f"Path: {clean_key}"
                )
                return False

            logger.info(
                f"Deleted Supabase file via REST: "
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

            base_url = self._base_url
            encoded_bucket = quote(self.models_bucket, safe="")
            encoded_path = quote(storage_key, safe="/")
            url = f"{base_url}/storage/v1/object/{encoded_bucket}/{encoded_path}"

            headers = {
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "apikey": settings.SUPABASE_SERVICE_KEY,
            }

            response = httpx.get(url, headers=headers, timeout=60.0)

            if not response.is_success:
                raise FileNotFoundError(
                    f"Model '{storage_key}' not found."
                )

            content = response.content

        except Exception as exc:

            logger.exception(
                f"Failed to download ML model "
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